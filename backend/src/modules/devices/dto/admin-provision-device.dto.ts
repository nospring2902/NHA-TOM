import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class AdminProvisionDeviceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^AS-\d{4}-\d{4}$/, {
    message: 'Serial phải đúng định dạng AS-XXXX-XXXX',
  })
  serialNumber!: string;
}
