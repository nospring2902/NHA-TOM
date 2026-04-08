import { HttpService } from '@nestjs/axios';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

type TbLoginResponse = {
  token?: string;
};

type TbCreateDeviceResponse = {
  id?:
    | {
        id?: string;
      }
    | string;
};

type TbDeviceCredentialsResponse = {
  credentialsId?: string;
};

@Injectable()
export class ThingsboardService {
  private adminJwtCache?: {
    token: string;
    expiresAtMs: number;
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async login(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.adminJwtCache && this.adminJwtCache.expiresAtMs > Date.now() + 30_000) {
      return this.adminJwtCache.token;
    }

    const username = this.configService.get<string>('THINGSBOARD_USERNAME');
    const password = this.configService.get<string>('THINGSBOARD_PASSWORD');

    if (!username || !password) {
      throw new InternalServerErrorException(
        'Thiếu cấu hình THINGSBOARD_USERNAME hoặc THINGSBOARD_PASSWORD',
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<TbLoginResponse>(
          `${this.resolveBaseUrl()}/api/auth/login`,
          {
            username,
            password,
          },
          {
            timeout: 10_000,
          },
        ),
      );

      const token = response.data?.token;
      if (!token) {
        throw new InternalServerErrorException('ThingsBoard không trả về JWT hợp lệ');
      }

      this.adminJwtCache = {
        token,
        expiresAtMs: this.resolveTokenExpiryMs(token),
      };

      return token;
    } catch (error) {
      const detail = this.parseTbErrorMessage(error);
      throw new ServiceUnavailableException(
        detail ? `Không thể đăng nhập ThingsBoard: ${detail}` : 'Không thể đăng nhập ThingsBoard',
      );
    }
  }

  async createDevice(serialNumber: string): Promise<string> {
    try {
      const response = await this.withAdminToken((token) =>
        firstValueFrom(
          this.httpService.post<TbCreateDeviceResponse>(
            `${this.resolveBaseUrl()}/api/device`,
            {
              name: serialNumber,
              type: 'SENSOR_GATEWAY',
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              timeout: 10_000,
            },
          ),
        ),
      );

      const tbDeviceId = this.extractTbDeviceId(response.data);
      if (!tbDeviceId) {
        throw new InternalServerErrorException('ThingsBoard không trả về tbDeviceId sau khi tạo thiết bị');
      }

      return tbDeviceId;
    } catch (error) {
      if (this.isDuplicateAxiosError(error)) {
        throw new ConflictException('Serial này đã tồn tại trên ThingsBoard');
      }

      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }

      const detail = this.parseTbErrorMessage(error);
      throw new ServiceUnavailableException(
        detail
          ? `Không thể tạo thiết bị trên ThingsBoard: ${detail}`
          : 'Không thể tạo thiết bị trên ThingsBoard',
      );
    }
  }

  async getDeviceCredentials(tbDeviceId: string): Promise<string> {
    try {
      const response = await this.withAdminToken((token) =>
        firstValueFrom(
          this.httpService.get<TbDeviceCredentialsResponse>(
            `${this.resolveBaseUrl()}/api/device/${tbDeviceId}/credentials`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              timeout: 10_000,
            },
          ),
        ),
      );

      const credentialsId = response.data?.credentialsId?.trim();
      if (!credentialsId) {
        throw new InternalServerErrorException(
          'ThingsBoard không trả về credentialsId cho thiết bị',
        );
      }

      return credentialsId;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const detail = this.parseTbErrorMessage(error);
      throw new ServiceUnavailableException(
        detail
          ? `Không thể lấy access token từ ThingsBoard: ${detail}`
          : 'Không thể lấy access token từ ThingsBoard',
      );
    }
  }

  private async withAdminToken<T>(request: (token: string) => Promise<T>): Promise<T> {
    const token = await this.login();

    try {
      return await request(token);
    } catch (error) {
      if (!this.isUnauthorizedAxiosError(error)) {
        throw error;
      }

      const refreshedToken = await this.login(true);
      return request(refreshedToken);
    }
  }

  private resolveBaseUrl(): string {
    const configured = this.configService.get<string>('THINGSBOARD_BASE_URL') ?? 'http://localhost:8080';
    return configured.replace(/\/+$/, '');
  }

  private resolveTokenExpiryMs(token: string): number {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) {
        return Date.now() + 4 * 60_000;
      }

      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const payloadRaw = Buffer.from(normalized, 'base64').toString('utf8');
      const payload = JSON.parse(payloadRaw) as { exp?: number };

      if (typeof payload.exp === 'number') {
        return payload.exp * 1000;
      }

      return Date.now() + 4 * 60_000;
    } catch {
      return Date.now() + 4 * 60_000;
    }
  }

  private extractTbDeviceId(payload: TbCreateDeviceResponse): string | null {
    if (typeof payload.id === 'string' && payload.id.trim()) {
      return payload.id.trim();
    }

    if (typeof payload.id === 'object' && payload.id && typeof payload.id.id === 'string') {
      return payload.id.id.trim();
    }

    return null;
  }

  private isUnauthorizedAxiosError(error: unknown): error is AxiosError {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const status = (error as AxiosError).response?.status;
    return status === 401;
  }

  private isDuplicateAxiosError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 409) {
      return true;
    }

    const detail = this.parseTbErrorMessage(error)?.toLowerCase() ?? '';
    return (
      detail.includes('already exists') ||
      detail.includes('duplicate') ||
      detail.includes('already assigned') ||
      detail.includes('đã tồn tại')
    );
  }

  private parseTbErrorMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const axiosError = error as AxiosError<{
      message?: string;
      error?: string;
      details?: string;
    }>;

    const payload = axiosError.response?.data;

    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }

    if (typeof payload?.details === 'string' && payload.details.trim()) {
      return payload.details.trim();
    }

    if (axiosError.message) {
      return axiosError.message;
    }

    return null;
  }
}
