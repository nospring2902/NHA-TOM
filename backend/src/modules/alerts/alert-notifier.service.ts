import { Injectable, Logger } from '@nestjs/common';
import { AlertSeverity, AlertStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PondAccessService } from '../collaboration/pond-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../mail/mail.service';

type MetricInput = {
  ph?: number | null;
  dissolvedOxygen?: number | null; // đang lưu độ đục (Turbidity - NTU)
  temperature?: number | null; // °C
  salinity?: number | null; // đang lưu TDS (mg/L)
};

type AlertViolation = {
  metricKey: string;
  severity: AlertSeverity;
  message: string;
};

// Cửa sổ chống trùng cho cảnh báo vượt ngưỡng: cùng một loại cảnh báo cho cùng
// một ao sẽ không phát lại trong khoảng thời gian này để tránh spam mỗi lần nhận telemetry.
const DEFAULT_COOLDOWN_MINUTES = 10;

@Injectable()
export class AlertNotifierService {
  private readonly logger = new Logger(AlertNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pondAccessService: PondAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Đánh giá các chỉ số telemetry và phát cảnh báo cho những chỉ số vượt ngưỡng.
   */
  async evaluateAndNotify(pondId: string, metrics: MetricInput): Promise<void> {
    try {
      const violations = this.evaluateMetrics(metrics);
      for (const violation of violations) {
        await this.createPondAlert({
          pondId,
          metricKey: violation.metricKey,
          severity: violation.severity,
          message: violation.message,
          dedup: { mode: 'window', minutes: DEFAULT_COOLDOWN_MINUTES },
        });
      }
    } catch (error) {
      this.logger.error(`Không thể đánh giá cảnh báo cho ao ${pondId}`, error as Error);
    }
  }

  /**
   * Phát cảnh báo mất kết nối thiết bị cho một ao.
   * Chỉ chống trùng khi vẫn còn cảnh báo mất kết nối đang mở (chưa được đóng lại
   * do thiết bị online trở lại), nên mỗi lần rớt mạng mới đều báo ngay.
   */
  async notifyConnectionLost(pondId: string, deviceLabel: string): Promise<void> {
    try {
      await this.createPondAlert({
        pondId,
        metricKey: 'connection',
        severity: AlertSeverity.HIGH,
        message: `Thiết bị ${deviceLabel} đã mất kết nối`,
        dedup: { mode: 'openOnly' },
      });
    } catch (error) {
      this.logger.error(`Không thể phát cảnh báo mất kết nối cho ao ${pondId}`, error as Error);
    }
  }

  /**
   * Đóng các cảnh báo mất kết nối đang mở của một ao khi thiết bị online trở lại,
   * để lần mất kết nối tiếp theo sẽ được phát cảnh báo mới.
   */
  async resolveConnectionAlerts(pondId: string): Promise<void> {
    try {
      await this.prisma.alert.updateMany({
        where: {
          pondId,
          metricKey: 'connection',
          status: AlertStatus.OPEN,
        },
        data: {
          status: AlertStatus.CLOSED,
          closedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Không thể đóng cảnh báo mất kết nối cho ao ${pondId}`, error as Error);
    }
  }

  private evaluateMetrics(metrics: MetricInput): AlertViolation[] {
    const violations: AlertViolation[] = [];

    const ph = this.toFiniteNumber(metrics.ph);
    if (ph != null && (ph < 7.2 || ph > 8.8)) {
      violations.push({
        metricKey: 'ph',
        severity: AlertSeverity.HIGH,
        message: `Độ pH = ${this.formatValue(ph)} vượt ngưỡng an toàn (7.2 – 8.8)`,
      });
    }

    const turbidity = this.toFiniteNumber(metrics.dissolvedOxygen);
    if (turbidity != null && turbidity > 300) {
      violations.push({
        metricKey: 'turbidity',
        severity: AlertSeverity.HIGH,
        message: `Độ đục = ${this.formatValue(turbidity)} NTU quá cao (ngưỡng an toàn < 300 NTU)`,
      });
    }

    const temperature = this.toFiniteNumber(metrics.temperature);
    if (temperature != null && (temperature < 26.5 || temperature > 32)) {
      violations.push({
        metricKey: 'temperature',
        severity: AlertSeverity.HIGH,
        message: `Nhiệt độ = ${this.formatValue(temperature)}°C ngoài ngưỡng an toàn (26.5 – 32°C)`,
      });
    }

    const tds = this.toFiniteNumber(metrics.salinity);
    if (tds != null && (tds < 100 || tds > 3000)) {
      violations.push({
        metricKey: 'tds',
        severity: AlertSeverity.HIGH,
        message: `TDS = ${this.formatValue(tds)} mg/L ngoài ngưỡng an toàn (100 – 3000 mg/L)`,
      });
    }

    return violations;
  }

  /**
   * Tạo bản ghi cảnh báo (nếu chưa có cảnh báo cùng loại trong cửa sổ chống trùng),
   * rồi gửi thông báo realtime + email cho chủ ao và toàn bộ thành viên.
   */
  private async createPondAlert(params: {
    pondId: string;
    metricKey: string;
    severity: AlertSeverity;
    message: string;
    dedup: { mode: 'window'; minutes: number } | { mode: 'openOnly' };
  }): Promise<void> {
    const { pondId, metricKey, severity, message, dedup } = params;

    const windowFilter =
      dedup.mode === 'window'
        ? { createdAt: { gte: new Date(Date.now() - dedup.minutes * 60 * 1000) } }
        : {};

    const recentAlert = await this.prisma.alert.findFirst({
      where: {
        pondId,
        metricKey,
        status: AlertStatus.OPEN,
        ...windowFilter,
      },
      select: { id: true },
    });

    if (recentAlert) {
      return; // đã có cảnh báo tương tự đang mở, bỏ qua để tránh spam
    }

    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { name: true },
    });

    if (!pond) {
      return;
    }

    const alert = await this.prisma.alert.create({
      data: {
        pondId,
        severity,
        status: AlertStatus.OPEN,
        metricKey,
        message,
      },
    });

    const userIds = await this.pondAccessService.getPondGroupUserIds(pondId);
    if (userIds.length === 0) {
      return;
    }

    const notificationTitle = `Cảnh báo ao ${pond.name}`;

    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.create(userId, 'alert', notificationTitle, message, {
          alertId: alert.id,
          pondId,
          metricKey,
          severity,
        }),
      ),
    );

    await this.sendAlertEmail(userIds, pond.name, message);
  }

  private async sendAlertEmail(userIds: string[], pondName: string, message: string) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    });

    const emails = users.map((user) => user.email).filter(Boolean);
    if (emails.length === 0) {
      return;
    }

    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    await this.mailerService.sendMail({
      to: emails,
      subject: `[NHATOM] Canh bao ao ${pondName}`,
      text:
        `Xin chao,\n\n` +
        `He thong NHATOM vua ghi nhan mot canh bao tai ao "${pondName}":\n\n` +
        `- Noi dung: ${message}\n` +
        `- Thoi diem: ${timestamp}\n\n` +
        `Vui long dang nhap vao ung dung de kiem tra chi tiet va xu ly kip thoi.\n\n` +
        `Day la email tu dong, vui long khong tra loi.`,
    });
  }

  private toFiniteNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private formatValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}
