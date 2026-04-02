import { ApiEnvelope } from './api';

export type DeviceMode = 'auto' | 'manual';
export type DeviceCommandAction = 'turn_on' | 'turn_off' | 'set_auto' | 'set_manual';

export type DeviceStatus = {
  id: string;
  pondId?: string;
  serialNumber?: string;
  model?: string;
  type: 'sensor_gateway' | 'aerator' | 'pump' | 'light' | 'feeder';
  mode: DeviceMode;
  isOn: boolean;
  telemetryPackets?: number;
  lastTelemetryAt?: string | null;
};

export type CreateDeviceCommandRequest = {
  action: DeviceCommandAction;
  reason?: string;
};

export type DeviceCommandResult = {
  pondId: string;
  deviceId: string;
  action: DeviceCommandAction;
  reason?: string;
  queuedAt: string;
};

export type DeviceListResponse = ApiEnvelope<DeviceStatus[]>;
export type DeviceCommandResponse = ApiEnvelope<DeviceCommandResult>;
