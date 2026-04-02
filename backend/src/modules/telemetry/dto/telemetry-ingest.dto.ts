import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TelemetryMetricsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ph?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dissolvedOxygen?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salinity?: number;
}

export class TelemetryIngestDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  thingsboardDeviceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelemetryMetricsDto)
  metrics?: TelemetryMetricsDto;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
