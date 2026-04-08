import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class DeviceTokenCipherService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plainToken: string): string {
    const key = this.resolveEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(sealedToken: string): string {
    try {
      const key = this.resolveEncryptionKey();
      const buffer = Buffer.from(sealedToken, 'base64');

      const iv = buffer.subarray(0, 12);
      const authTag = buffer.subarray(12, 28);
      const encrypted = buffer.subarray(28);

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Không thể giải mã access token thiết bị');
    }
  }

  maskToken(token: string): string {
    if (token.length <= 6) {
      return '***';
    }

    return `${token.slice(0, 4)}***${token.slice(-2)}`;
  }

  private resolveEncryptionKey(): Buffer {
    const configuredKey = this.configService.get<string>('DEVICE_TOKEN_ENCRYPTION_KEY');
    const fallbackKey =
      this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'nhatom-device-token-encryption';

    const source = configuredKey?.trim().length ? configuredKey : fallbackKey;
    return createHash('sha256').update(source).digest();
  }
}
