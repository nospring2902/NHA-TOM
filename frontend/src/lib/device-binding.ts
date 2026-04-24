import axios from "axios";
import { http } from "@/lib/http";

export const SERIAL_PATTERN = /^AS-\d{4}-\d{4}$/;

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type BoundDevice = {
  id: string;
  pondId: string;
  serialNumber: string;
  model: string;
  type: string;
  status:
    | "INACTIVE"
    | "WAITING_SIGNAL"
    | "ONLINE"
    | "OFFLINE"
    | "ERROR"
    | "MAINTENANCE";
  telemetryPackets: number;
  boundAt: string;
  lastTelemetryAt: string | null;
};

export type TelemetryStatus = {
  deviceId: string;
  serialNumber: string;
  status: "WAITING_SIGNAL" | "ONLINE" | "OFFLINE";
  isOnline: boolean;
  telemetryPackets: number;
  lastTelemetryAt: string | null;
};

export type CreatedPond = {
  id: string;
  name: string;
  location: string;
  areaM2: number;
  latitude?: number | null;
  longitude?: number | null;
  geo?: {
    lat: number;
    lng: number;
  } | null;
  lifecycleStatus?: string;
};

type CreatePondRequest = {
  name: string;
  farmName: string;
  province: string;
  district: string;
  ward: string;
  areaM2: number;
  averageDepthM: number;
  waterType: "freshwater" | "brackish" | "marine";
  timezone: string;
  devices: Array<{
    serialNumber: string;
    type: "sensor_gateway";
  }>;
};

export type CreatePondAndBindInput = {
  pondName: string;
  location: string;
  areaM2: number;
  serialNumber: string;
};

export type CreatePondAndBindResult = {
  pond: CreatedPond;
  device: BoundDevice;
};

const splitLocation = (location: string) => {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const province = parts.at(-1) ?? location;
  const district = parts.length > 1 ? (parts.at(-2) ?? province) : province;
  const ward = parts.length > 2 ? parts.slice(0, -2).join(", ") : district;

  return { province, district, ward };
};

export const formatSerialNumberInput = (input: string): string => {
  const upper = input.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9]/g, "");

  if (!cleaned) {
    return "";
  }

  if (!cleaned.startsWith("A")) {
    return cleaned.slice(0, 1);
  }

  if (cleaned.length === 1) {
    return "A";
  }

  // If the second character is not S, we still continue formatting instead of locking input.
  const body = cleaned.startsWith("AS") ? cleaned.slice(2) : cleaned.slice(1);
  const digits = body.replace(/\D/g, "").slice(0, 8);
  const block1 = digits.slice(0, 4);
  const block2 = digits.slice(4, 8);

  let formatted = "AS-";
  if (block1) {
    formatted += block1;
  }
  if (block2) {
    formatted += `-${block2}`;
  }

  return formatted;
};

export const bindDeviceToPond = async (
  pondId: string,
  serialNumber: string,
): Promise<ApiEnvelope<BoundDevice>> => {
  const response = await http.post<ApiEnvelope<BoundDevice>>(`/ponds/${pondId}/bind-device`, {
    serialNumber,
  });
  return response.data;
};

export const createPond = async (
  input: CreatePondAndBindInput,
): Promise<ApiEnvelope<CreatedPond>> => {
  const locationParts = splitLocation(input.location);
  const payload: CreatePondRequest = {
    name: input.pondName,
    farmName: "Farm cá nhân",
    province: locationParts.province,
    district: locationParts.district,
    ward: locationParts.ward,
    areaM2: input.areaM2,
    averageDepthM: 1.5,
    waterType: "brackish",
    timezone: "Asia/Ho_Chi_Minh",
    devices: [
      {
        serialNumber: input.serialNumber,
        type: "sensor_gateway",
      },
    ],
  };

  const response = await http.post<ApiEnvelope<CreatedPond>>("/ponds", payload);
  return response.data;
};

export const createPondAndBindDevice = async (
  input: CreatePondAndBindInput,
): Promise<CreatePondAndBindResult> => {
  const createResult = await createPond(input);

  try {
    const bindResult = await bindDeviceToPond(createResult.data.id, input.serialNumber);
    return {
      pond: createResult.data,
      device: bindResult.data,
    };
  } catch (error) {
    // If bind fails, delete the just-created pond to avoid leaving incomplete setup.
    try {
      await http.delete(`/ponds/${createResult.data.id}`);
    } catch {
      // Keep original bind error as the main signal for UI.
    }
    throw error;
  }
};

export const getTelemetryStatus = async (
  pondId: string,
  deviceId: string,
): Promise<ApiEnvelope<TelemetryStatus>> => {
  const response = await http.get<ApiEnvelope<TelemetryStatus>>(
    `/ponds/${pondId}/devices/${deviceId}/telemetry-status`,
  );
  return response.data;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string | string[];
          error?: string;
        }
      | undefined;

    if (Array.isArray(data?.message)) {
      return data.message.join(", ");
    }

    if (typeof data?.message === "string" && data.message.length > 0) {
      return data.message;
    }

    if (typeof data?.error === "string" && data.error.length > 0) {
      return data.error;
    }

    if (error.code === "ECONNABORTED") {
      return "Quá thời gian kết nối tới backend. Vui lòng thử lại.";
    }

    if (!error.response) {
      return "Không kết nối được backend. Kiểm tra server và VITE_API_BASE_URL.";
    }

    return fallback;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
};
