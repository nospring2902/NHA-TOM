import { http } from '@/lib/http';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type RealtimeMetricPoint = {
  measuredAt: string;
  ph: number | null;
  dissolvedOxygen: number | null;
  temperature: number | null;
  salinity: number | null;
};

export type RealtimeDevice = {
  id: string;
  serialNumber: string;
  model: string;
  type: string;
  status: 'INACTIVE' | 'WAITING_SIGNAL' | 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';
  lastTelemetryAt: string | null;
  telemetryPackets: number;
  isActive: boolean;
  boundAt: string;
};

export type DashboardRealtime = {
  pondId: string;
  score: number | null;
  level: 'unknown' | 'excellent' | 'good' | 'fair' | 'poor';
  latestMetric: RealtimeMetricPoint | null;
  metricsHistory: RealtimeMetricPoint[];
  devices: RealtimeDevice[];
};

export const getDashboardRealtime = async (
  pondId: string,
): Promise<ApiEnvelope<DashboardRealtime>> => {
  const response = await http.get<ApiEnvelope<DashboardRealtime>>(
    `/ponds/${pondId}/dashboard/realtime`,
  );

  return response.data;
};
