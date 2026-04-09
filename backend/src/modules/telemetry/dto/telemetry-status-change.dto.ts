import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class TelemetryStatusChangeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  deviceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tbDeviceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  thingsboardDeviceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    if (value.trim().toLowerCase() === 'true') {
      return true;
    }

    if (value.trim().toLowerCase() === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
