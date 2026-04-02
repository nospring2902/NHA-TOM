import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DeviceCommandAction {
  TURN_ON = 'turn_on',
  TURN_OFF = 'turn_off',
  SET_AUTO = 'set_auto',
  SET_MANUAL = 'set_manual',
}

export class CreateDeviceCommandDto {
  @IsEnum(DeviceCommandAction)
  action!: DeviceCommandAction;

  @IsOptional()
  @IsString()
  reason?: string;
}
