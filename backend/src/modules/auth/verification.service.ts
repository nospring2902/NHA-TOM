import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private mailTransporter?: Transporter;

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

  async issuePasswordChangeCode(user: User): Promise<boolean> {
    const code = this.generateCode();
    const expiresAt = this.getExpiryDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordChangeCodeHash: this.hashCode(code),
        passwordChangeExpiresAt: expiresAt,
      },
    });

    try {
      await this.sendPasswordChangeCode(user.email, user.fullName, code, expiresAt);
      return true;
    } catch (error) {
      this.logger.error('Failed to send password change code', error);
      return false;
    }
  }

  assertPasswordChangeCode(user: User, code: string) {
    this.assertValidCode(code, user.passwordChangeCodeHash, user.passwordChangeExpiresAt);
  }

  async issueForgotPasswordCode(user: User): Promise<boolean> {
    const code = this.generateCode();
    const expiresAt = this.getExpiryDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordChangeCodeHash: this.hashCode(code),
        passwordChangeExpiresAt: expiresAt,
        pendingPasswordHash: null,
      },
    });

    try {
      await this.sendForgotPasswordCode(user.email, user.fullName, code, expiresAt);
      return true;
    } catch (error) {
      this.logger.error('Failed to send forgot password code', error);
      return false;
    }
  }

  async isUserVerified(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerifiedAt: true,
      },
    });

    return Boolean(user?.emailVerifiedAt);
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

  private async sendForgotPasswordCode(email: string, fullName: string, code: string, expiresAt: Date) {
    const transporter = this.getMailTransporter();
    const from = this.configService.get<string>('EMAIL_FROM') ?? 'NHATOM <no-reply@nhatom.local>';
    const ttlMinutes = this.configService.get<string>('VERIFICATION_CODE_TTL_MINUTES') ?? '10';

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Dat lai mat khau NHATOM',
      text: `Xin chao ${fullName},\n\nChung toi nhan duoc yeu cau dat lai mat khau cho tai khoan NHATOM gan voi email nay.\nMa xac nhan cua ban la: ${code}.\nMa co hieu luc trong ${ttlMinutes} phut (den ${expiresAt.toLocaleTimeString()}).\n\nNeu ban khong gui yeu cau nay, vui long bo qua email nay. Mat khau cua ban van an toan.`,
    });
  }

  private async sendPasswordChangeCode(email: string, fullName: string, code: string, expiresAt: Date) {
    const transporter = this.getMailTransporter();
    const from = this.configService.get<string>('EMAIL_FROM') ?? 'NHATOM <no-reply@nhatom.local>';
    const ttlMinutes = this.configService.get<string>('VERIFICATION_CODE_TTL_MINUTES') ?? '10';

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Ma xac nhan doi mat khau NHATOM',
      text: `Xin chao ${fullName},\n\nBan vua yeu cau doi mat khau tai khoan NHATOM.\nMa xac nhan cua ban la: ${code}.\nMa co hieu luc trong ${ttlMinutes} phut (den ${expiresAt.toLocaleTimeString()}).\n\nNeu ban khong yeu cau doi mat khau, vui long bo qua email nay va doi mat khau ngay.`,
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
}
