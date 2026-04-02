import { ApiEnvelope } from './api';

export type MetricPoint = {
  measuredAt: string;
  ph: number;
  dissolvedOxygen: number;
  temperature: number;
  salinity: number;
};

export type MetricHistoryQuery = {
  from?: string;
  to?: string;
  interval?: '1m' | '5m' | '15m' | '1h';
};

export type LatestMetricResponse = ApiEnvelope<MetricPoint>;
export type MetricHistoryResponse = ApiEnvelope<{ points: MetricPoint[] }>;
