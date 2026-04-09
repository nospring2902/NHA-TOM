import { ApiEnvelope } from './api';

export type PondWaterType = 'freshwater' | 'brackish' | 'marine';
export type PondLifecycleStatus = 'draft' | 'provisioning' | 'waiting_telemetry' | 'active' | 'paused';

export type DeviceType = 'sensor_gateway' | 'aerator' | 'pump' | 'light' | 'feeder';

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type DeviceProvisioning = {
  serialNumber: string;
  type: DeviceType;
  firmwareVersion?: string;
};

export type CreatePondRequest = {
  name: string;
  farmName: string;
  province: string;
  district: string;
  ward: string;
  areaM2: number;
  averageDepthM: number;
  waterType: PondWaterType;
  geo?: GeoPoint;
  timezone?: string;
  devices: DeviceProvisioning[];
};

export type UpdatePondRequest = Partial<Omit<CreatePondRequest, 'devices'>>;

export type PondProvisioningState = {
  step: 'device_binding' | 'calibration' | 'waiting_telemetry' | 'completed';
  requiredTelemetryWindowMinutes: number;
  minimumSensorPackets: number;
};

export type Pond = {
  id: string;
  name: string;
  farmName: string;
  province: string;
  district: string;
  ward: string;
  areaM2: number;
  averageDepthM: number;
  waterType: PondWaterType;
  lifecycleStatus: PondLifecycleStatus;
  provisioning?: PondProvisioningState;
};

export type BindDeviceRequest = {
  serialNumber: string;
};

export type BoundDevice = {
  id: string;
  pondId: string;
  serialNumber: string;
  model: string;
  type: string;
  status: 'WAITING_SIGNAL' | 'ONLINE' | 'OFFLINE';
  telemetryPackets: number;
  boundAt: string;
  lastTelemetryAt: string | null;
};

export type DeviceTelemetryStatus = {
  deviceId: string;
  serialNumber: string;
  status: 'WAITING_SIGNAL' | 'ONLINE' | 'OFFLINE';
  isOnline: boolean;
  telemetryPackets: number;
  lastTelemetryAt: string | null;
};

export type PondResponse = ApiEnvelope<Pond>;
export type PondListResponse = ApiEnvelope<Pond[]>;
export type BindDeviceResponse = ApiEnvelope<BoundDevice>;
export type DeviceTelemetryStatusResponse = ApiEnvelope<DeviceTelemetryStatus>;
