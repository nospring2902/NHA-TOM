import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum PondWaterType {
  FRESHWATER = 'freshwater',
  BRACKISH = 'brackish',
  MARINE = 'marine',
}

export enum DeviceType {
  SENSOR_GATEWAY = 'sensor_gateway',
  AERATOR = 'aerator',
  PUMP = 'pump',
  LIGHT = 'light',
  FEEDER = 'feeder',
}

export class DeviceProvisioningDto {
  @IsString()
  serialNumber!: string;

  @IsEnum(DeviceType)
  type!: DeviceType;

  @IsOptional()
  @IsString()
  firmwareVersion?: string;
}

export class PondGeoDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class CreatePondDto {
  @IsString()
  name!: string;

  @IsString()
  farmName!: string;

  @IsString()
  province!: string;

  @IsString()
  district!: string;

  @IsString()
  ward!: string;

  @IsNumber()
  areaM2!: number;

  @IsNumber()
  averageDepthM!: number;

  @IsEnum(PondWaterType)
  waterType!: PondWaterType;

  @IsOptional()
  @ValidateNested()
  @Type(() => PondGeoDto)
  geo?: PondGeoDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceProvisioningDto)
  devices!: DeviceProvisioningDto[];

  @IsOptional()
  @IsString()
  timezone?: string;
}
