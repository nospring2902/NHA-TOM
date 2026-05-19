import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import twilio, { type Twilio } from 'twilio';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private mailTransporter?: Transporter;
  private twilioClient?: Twilio;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async issueEmailVerification(user: User): Promise<boolean> {
    const code = this.generateCode();
    const expiresAt = this.getExpiryDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCodeHash: this.hashCode(code),
        emailVerificationExpiresAt: expiresAt,
      },
    });

    try {
      await this.sendEmailCode(user.email, user.fullName, code, expiresAt);
      return true;
    } catch (error) {
      this.logger.error('Failed to send email verification code', error);
      return false;
    }
  }

  async issuePhoneVerification(user: User): Promise<boolean> {
    if (!user.phone) {
      return false;
    }

    const code = this.generateCode();
    const expiresAt = this.getExpiryDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCodeHash: this.hashCode(code),
        phoneVerificationExpiresAt: expiresAt,
      },
    });

    try {
      await this.sendSmsCode(user.phone, code, expiresAt);
      return true;
    } catch (error) {
      this.logger.error('Failed to send phone verification code', error);
      return false;
    }
  }

  async verifyEmailCode(user: User, code: string) {
    if (user.emailVerifiedAt) {
      return;
    }

    this.assertValidCode(code, user.emailVerificationCodeHash, user.emailVerificationExpiresAt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  async verifyPhoneCode(user: User, code: string) {
    if (user.phoneVerifiedAt) {
      return;
    }

    if (!user.phone) {
      throw new BadRequestException('Vui lòng cập nhật số điện thoại trước khi xác minh');
    }

    this.assertValidCode(code, user.phoneVerificationCodeHash, user.phoneVerificationExpiresAt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerifiedAt: new Date(),
        phoneVerificationCodeHash: null,
        phoneVerificationExpiresAt: null,
      },
    });
  }

  async isUserVerified(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        phone: true,
      },
    });

    return Boolean(user?.emailVerifiedAt && user?.phoneVerifiedAt && user?.phone);
  }

  private assertValidCode(code: string, storedHash?: string | null, expiresAt?: Date | null) {
    if (!storedHash || !expiresAt) {
      throw new BadRequestException('Mã xác minh không hợp lệ');
    }

    if (expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Mã xác minh đã hết hạn');
    }

    const incomingHash = this.hashCode(code);
    if (incomingHash !== storedHash) {
      throw new BadRequestException('Mã xác minh không chính xác');
    }
  }

  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private getExpiryDate(): Date {
    const ttlRaw = this.configService.get<string>('VERIFICATION_CODE_TTL_MINUTES') ?? '10';
    const ttl = Number.parseInt(ttlRaw, 10);
    const minutes = Number.isFinite(ttl) && ttl > 0 ? ttl : 10;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
    return expiresAt;
  }

  private hashCode(code: string): string {
    const secret = this.configService.get<string>('VERIFICATION_CODE_SECRET') ?? 'nhatom-dev-verification';
    return createHash('sha256').update(`${code}.${secret}`).digest('hex');
  }

  private async sendEmailCode(email: string, fullName: string, code: string, expiresAt: Date) {
    const transporter = this.getMailTransporter();
    const from = this.configService.get<string>('EMAIL_FROM') ?? 'NHATOM <no-reply@nhatom.local>';
    const ttlMinutes = this.configService.get<string>('VERIFICATION_CODE_TTL_MINUTES') ?? '10';

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Ma xac minh tai khoan NHATOM',
      text: `Xin chao ${fullName},\n\nMa xac minh cua ban la: ${code}.\nMa co hieu luc trong ${ttlMinutes} phut (den ${expiresAt.toLocaleTimeString()}).\n\nNeu ban khong yeu cau, vui long bo qua email nay.`,
    });
  }

  private getMailTransporter(): Transporter {
    if (this.mailTransporter) {
      return this.mailTransporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      throw new Error('SMTP_HOST is required to send verification emails');
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

  private getTwilioClient(): Twilio {
    if (this.twilioClient) {
      return this.twilioClient;
    }

    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required to send SMS');
    }

    this.twilioClient = twilio(accountSid, authToken);
    return this.twilioClient;
  }

  private async sendSmsCode(phone: string, code: string, expiresAt: Date) {
    const from = this.configService.get<string>('TWILIO_FROM');
    const messagingServiceSid = this.configService.get<string>('TWILIO_MESSAGING_SERVICE_SID');
    if (!from && !messagingServiceSid) {
      throw new Error('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID is required to send SMS');
    }
    const ttlMinutes = this.configService.get<string>('VERIFICATION_CODE_TTL_MINUTES') ?? '10';

    const normalizedPhone = this.normalizeTwilioPhone(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('So dien thoai khong hop le');
    }

    const body = `Ma xac minh NHATOM: ${code}. Hieu luc ${ttlMinutes} phut (den ${expiresAt.toLocaleTimeString()}).`;

    try {
      const client = this.getTwilioClient();
      await client.messages.create({
        to: normalizedPhone,
        body,
        ...(messagingServiceSid ? { messagingServiceSid } : { from }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Twilio error';
      this.logger.error(`Twilio error: ${message}`);
      throw new BadRequestException(`Twilio error: ${message}`);
    }
  }

  private normalizeTwilioPhone(phone: string): string {
    const cleaned = phone.trim().replace(/[^\d+]/g, '');
    if (!cleaned) {
      return '';
    }

    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    if (cleaned.startsWith('84')) {
      return `+${cleaned}`;
    }

    if (cleaned.startsWith('0')) {
      return `+84${cleaned.slice(1)}`;
    }

    return `+84${cleaned}`;
  }
}
