import { http } from '@/lib/http';

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type AdminDeviceOwner = {
  id: string;
  email: string;
  fullName: string;
};

export type AdminDevice = {
  id: string;
  serialNumber: string;
  tbDeviceId: string | null;
  status: string;
  isActive: boolean;
  ownerId: string | null;
  owner: AdminDeviceOwner | null;
  hasOwner: boolean;
  accessTokenMasked: string | null;
  createdAt: string;
};

export type ProvisionedAdminDevice = {
  id: string;
  serialNumber: string;
  tbDeviceId: string | null;
  status: string;
  ownerId: string | null;
  owner: AdminDeviceOwner | null;
  hasOwner: boolean;
  accessToken: string;
  accessTokenMasked: string;
  createdAt: string;
};

export const listAdminDevices = async (): Promise<ApiEnvelope<AdminDevice[]>> => {
  const response = await http.get<ApiEnvelope<AdminDevice[]>>('/admin/devices');
  return response.data;
};

export const provisionAdminDevice = async (
  serialNumber: string,
): Promise<ApiEnvelope<ProvisionedAdminDevice>> => {
  const response = await http.post<ApiEnvelope<ProvisionedAdminDevice>>('/admin/devices/provision', {
    serialNumber,
  });

  return response.data;
};

export const getAdminDeviceAccessToken = async (
  deviceId: string,
): Promise<ApiEnvelope<{ id: string; serialNumber: string; accessToken: string; accessTokenMasked: string }>> => {
  const response = await http.get<
    ApiEnvelope<{ id: string; serialNumber: string; accessToken: string; accessTokenMasked: string }>
  >(`/admin/devices/${deviceId}/access-token`);

  return response.data;
};
