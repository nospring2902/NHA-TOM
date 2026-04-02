import { ApiEnvelope } from './api';

export type WaterScore = {
  score: number;
  level: 'good' | 'warning' | 'danger';
};

export type AlertItem = {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  predictedFor?: string;
};

export type ActivityLogItem = {
  action: string;
  trigger: string;
  createdAt: string;
};

export type WaterScoreResponse = ApiEnvelope<WaterScore>;
export type AlertListResponse = ApiEnvelope<AlertItem[]>;
export type ActivityLogListResponse = ApiEnvelope<ActivityLogItem[]>;
