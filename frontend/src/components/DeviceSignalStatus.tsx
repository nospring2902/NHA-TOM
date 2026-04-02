import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Wifi } from "lucide-react";
import { getTelemetryStatus, getApiErrorMessage } from "@/lib/device-binding";

type DeviceSignalStatusProps = {
  pondId: string;
  deviceId: string;
  onStatusChange?: (isOnline: boolean) => void;
};

export const DeviceSignalStatus = ({
  pondId,
  deviceId,
  onStatusChange,
}: DeviceSignalStatusProps) => {
  const [isOnline, setIsOnline] = useState(false);
  const [message, setMessage] = useState("Đang đợi tín hiệu từ thiết bị...");
  const [lastTelemetryAt, setLastTelemetryAt] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const result = await getTelemetryStatus(pondId, deviceId);
        if (!isMounted) {
          return;
        }

        setHasError(false);
        setIsOnline(result.data.isOnline);
        setMessage(result.message);
        setLastTelemetryAt(result.data.lastTelemetryAt);
        onStatusChange?.(result.data.isOnline);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setHasError(true);
        setMessage(getApiErrorMessage(error, "Không thể kiểm tra tín hiệu thiết bị"));
      }
    };

    // Polling every 4s to simulate waiting for first telemetry packet.
    void pollStatus();
    const timer = window.setInterval(() => {
      void pollStatus();
    }, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [pondId, deviceId, onStatusChange]);

  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 p-2.5">
      <div className="flex items-center gap-2 text-sm">
        {hasError ? (
          <AlertTriangle className="h-4 w-4 text-coral" />
        ) : isOnline ? (
          <Wifi className="h-4 w-4 text-aqua" />
        ) : (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        )}
        <span className={isOnline ? "text-aqua font-medium" : "text-muted-foreground"}>{message}</span>
      </div>
      {lastTelemetryAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          Telemetry gần nhất: {new Date(lastTelemetryAt).toLocaleString("vi-VN")}
        </p>
      )}
    </div>
  );
};
