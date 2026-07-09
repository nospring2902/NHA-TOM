import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private mailTransporter?: Transporter;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generic email sender. Never throws — logs and returns false on failure so
   * callers (alerts, notifications) are not broken by mail issues.
   */
  async sendMail(options: {
    to: string | string[];
    subject: string;
    text: string;
  }): Promise<boolean> {
    const recipients = Array.isArray(options.to)
      ? options.to.filter(Boolean)
      : [options.to].filter(Boolean);

    if (recipients.length === 0) {
      return false;
    }

    try {
      const transporter = this.getMailTransporter();
      const from =
        this.configService.get<string>('EMAIL_FROM') ?? 'NHATOM <no-reply@nhatom.local>';

      await transporter.sendMail({
        from,
        to: recipients,
        subject: options.subject,
        text: options.text,
      });

      return true;
    } catch (error) {
      this.logger.error('Không gửi được email', error as Error);
      return false;
    }
  }

  private getMailTransporter(): Transporter {
    if (this.mailTransporter) {
      return this.mailTransporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      throw new Error('SMTP_HOST is required to send emails');
    }

    const portRaw = this.configService.get<string>('SMTP_PORT') ?? '587';
    const port = Number.parseInt(portRaw, 10);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.mailTransporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.mailTransporter;
  }
}
