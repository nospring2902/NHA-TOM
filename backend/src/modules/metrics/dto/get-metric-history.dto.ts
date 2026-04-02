import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class GetMetricHistoryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['1m', '5m', '15m', '1h'])
  interval?: string;
}
