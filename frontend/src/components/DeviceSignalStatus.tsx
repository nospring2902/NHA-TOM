import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Wifi } from "lucide-react";
import {
  formatLastActiveFromLastTelemetry,
  HEARTBEAT_TIMEOUT_MS,
  type RealtimeSignalStatus,
  resolveSignalStatusFromLastTelemetry,
} from "@/lib/device-status";

type DeviceSignalStatusProps = {
  lastTelemetryAt: string | null;
  onStatusChange?: (status: RealtimeSignalStatus) => void;
};

export const DeviceSignalStatus = ({ lastTelemetryAt, onStatusChange }: DeviceSignalStatusProps) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const status = useMemo(
    () => resolveSignalStatusFromLastTelemetry(lastTelemetryAt, nowMs),
    [lastTelemetryAt, nowMs],
  );

  const statusMessage = useMemo(() => {
    if (status === "ONLINE") {
      return "Trực tuyến";
    }

    if (status === "OFFLINE") {
      return "Mất tín hiệu";
    }

    return "Đang đợi tín hiệu";
  }, [status]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  const lastActiveLabel = useMemo(
    () => formatLastActiveFromLastTelemetry(lastTelemetryAt, nowMs),
    [lastTelemetryAt, nowMs],
  );

  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 p-2.5">
      <div className="flex items-center gap-2 text-sm">
        {status === "ONLINE" ? (
          <Wifi className="h-4 w-4 text-aqua" />
        ) : status === "OFFLINE" ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <span
          className={
            status === "ONLINE"
              ? "text-aqua font-medium"
              : status === "OFFLINE"
                ? "text-destructive font-medium"
                : "text-muted-foreground"
          }
        >
          {statusMessage}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Hoạt động lần cuối: {lastActiveLabel} · timeout {Math.floor(HEARTBEAT_TIMEOUT_MS / 1000)}s
      </p>
    </div>
  );
};
