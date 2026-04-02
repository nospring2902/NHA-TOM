import { Matches, IsNotEmpty, IsString, IsUUID } from 'class-validator';

const SERIAL_PATTERN = /^AS-\d{4}-\d{4}$/;

export class BindDeviceToPondDto {
  @IsUUID()
  @IsNotEmpty()
  pondId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(SERIAL_PATTERN, {
    message: 'serialNumber phải có dạng AS-0000-0000',
  })
  serialNumber!: string;
}
