import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";

export const HEARTBEAT_TIMEOUT_MS = 5 * 1000;

export type RealtimeSignalStatus = "WAITING_SIGNAL" | "ONLINE" | "OFFLINE";

const toTelemetryDate = (lastTelemetryAt: string | null | undefined): Date | null => {
  if (!lastTelemetryAt) {
    return null;
  }

  const parsed = new Date(lastTelemetryAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const resolveSignalStatusFromLastTelemetry = (
  lastTelemetryAt: string | null | undefined,
  nowMs = Date.now(),
): RealtimeSignalStatus => {
  const telemetryDate = toTelemetryDate(lastTelemetryAt);
  if (!telemetryDate) {
    return "WAITING_SIGNAL";
  }

  return nowMs - telemetryDate.getTime() < HEARTBEAT_TIMEOUT_MS ? "ONLINE" : "OFFLINE";
};

export const isOnlineFromLastTelemetry = (
  lastTelemetryAt: string | null | undefined,
  nowMs = Date.now(),
): boolean => {
  return resolveSignalStatusFromLastTelemetry(lastTelemetryAt, nowMs) === "ONLINE";
};

export const formatLastActiveFromLastTelemetry = (
  lastTelemetryAt: string | null | undefined,
  nowMs = Date.now(),
): string => {
  const telemetryDate = toTelemetryDate(lastTelemetryAt);
  if (!telemetryDate) {
    return "Chưa nhận dữ liệu";
  }

  return formatDistanceToNowStrict(telemetryDate, {
    addSuffix: true,
    locale: vi,
    now: nowMs,
  });
};
