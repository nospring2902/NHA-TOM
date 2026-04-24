import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PondGeoDto, PondWaterType } from './create-pond.dto';

export class UpdatePondDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsNumber()
  areaM2?: number;

  @IsOptional()
  @IsNumber()
  averageDepthM?: number;

  @IsOptional()
  @IsEnum(PondWaterType)
  waterType?: PondWaterType;

  @IsOptional()
  @ValidateNested()
  @Type(() => PondGeoDto)
  geo?: PondGeoDto;
}
