import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Grid3x3, Waves, Settings, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AddPondModal } from "@/components/AddPondModal";
import { DeviceSignalStatus } from "@/components/DeviceSignalStatus";
import { BoundDevice, CreatePondAndBindResult, getTelemetryStatus } from "@/lib/device-binding";
import { type RealtimeSignalStatus } from "@/lib/device-status";
import AppLayout from "@/components/AppLayout";

const userPosts = [
  { id: 1, preview: "Thu hoạch vụ tôm thành công 🦐" },
  { id: 2, preview: "Chia sẻ kinh nghiệm xử lý pH" },
  { id: 3, preview: "Ao mới lắp cảm biến IoT" },
  { id: 4, preview: "Kết quả sau 3 tháng sử dụng" },
  { id: 5, preview: "Tips nuôi tôm mùa mưa" },
  { id: 6, preview: "Đánh giá hệ thống cảnh báo" },
];

const userPonds = [
  { id: 1, name: "Ao Tôm A1", area: "2,000 m²", location: "Cà Mau" },
  { id: 2, name: "Ao Tôm A2", area: "1,500 m²", location: "Cà Mau" },
  { id: 3, name: "Ao Tôm B1", area: "3,000 m²", location: "Bạc Liêu" },
];

type PondSetupStatus = "READY" | RealtimeSignalStatus;

type ProfilePond = {
  id: string;
  name: string;
  area: string;
  location: string;
  status: PondSetupStatus;
  boundDevice?: BoundDevice;
};

const statusUi: Record<PondSetupStatus, { label: string; className: string }> = {
  READY: {
    label: "Sẵn sàng vận hành",
    className: "bg-secondary text-secondary-foreground",
  },
  WAITING_SIGNAL: {
    label: "Đang đợi tín hiệu",
    className: "bg-coral/10 text-coral",
  },
  ONLINE: {
    label: "Đã trực tuyến",
    className: "bg-aqua-light text-aqua",
  },
  OFFLINE: {
    label: "Mất tín hiệu",
    className: "bg-destructive/10 text-destructive",
  },
};

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState<"posts" | "ponds">("posts");
  const [ponds, setPonds] = useState<ProfilePond[]>(
    userPonds.map((pond) => ({
      id: String(pond.id),
      name: pond.name,
      area: pond.area,
      location: pond.location,
      status: "READY",
    })),
  );

  const telemetryTargets = useMemo(() => {
    return ponds
      .filter((pond) => Boolean(pond.boundDevice))
      .map((pond) => ({
        pondId: pond.id,
        deviceId: pond.boundDevice!.id,
      }));
  }, [ponds]);

  const telemetryTargetKey = useMemo(() => {
    return telemetryTargets
      .map((item) => `${item.pondId}:${item.deviceId}`)
      .sort()
      .join("|");
  }, [telemetryTargets]);

  useEffect(() => {
    if (telemetryTargets.length === 0) {
      return;
    }

    let isMounted = true;

    const pollTelemetryStatus = async () => {
      const results = await Promise.allSettled(
        telemetryTargets.map(async (target) => {
          const result = await getTelemetryStatus(target.pondId, target.deviceId);
          return {
            pondId: target.pondId,
            deviceId: target.deviceId,
            status: result.data.status,
            telemetryPackets: result.data.telemetryPackets,
            lastTelemetryAt: result.data.lastTelemetryAt,
          };
        }),
      );

      if (!isMounted) {
        return;
      }

      const statusByTarget = new Map<
        string,
        {
          status: BoundDevice["status"];
          telemetryPackets: number;
          lastTelemetryAt: string | null;
        }
      >();

      for (const result of results) {
        if (result.status !== "fulfilled") {
          continue;
        }

        const key = `${result.value.pondId}:${result.value.deviceId}`;
        statusByTarget.set(key, {
          status: result.value.status,
          telemetryPackets: result.value.telemetryPackets,
          lastTelemetryAt: result.value.lastTelemetryAt,
        });
      }

      if (statusByTarget.size === 0) {
        return;
      }

      setPonds((current) => {
        let hasChanges = false;

        const next = current.map((item) => {
          if (!item.boundDevice) {
            return item;
          }

          const key = `${item.id}:${item.boundDevice.id}`;
          const nextStatus = statusByTarget.get(key);
          if (!nextStatus) {
            return item;
          }

          const isBoundDeviceChanged =
            item.boundDevice.status !== nextStatus.status ||
            item.boundDevice.telemetryPackets !== nextStatus.telemetryPackets ||
            item.boundDevice.lastTelemetryAt !== nextStatus.lastTelemetryAt;

          if (!isBoundDeviceChanged) {
            return item;
          }

          hasChanges = true;
          return {
            ...item,
            boundDevice: {
              ...item.boundDevice,
              status: nextStatus.status,
              telemetryPackets: nextStatus.telemetryPackets,
              lastTelemetryAt: nextStatus.lastTelemetryAt,
            },
          };
        });

        return hasChanges ? next : current;
      });
    };

    void pollTelemetryStatus();
    const timer = window.setInterval(() => {
      void pollTelemetryStatus();
    }, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [telemetryTargetKey, telemetryTargets]);

  const handlePondCreated = (result: CreatePondAndBindResult) => {
    setPonds((current) => {
      const withoutDuplicated = current.filter((item) => item.id !== result.pond.id);
      return [
        {
          id: result.pond.id,
          name: result.pond.name,
          area: `${result.pond.areaM2.toLocaleString("vi-VN")} m²`,
          location: result.pond.location,
          status: "WAITING_SIGNAL",
          boundDevice: result.device,
        },
        ...withoutDuplicated,
      ];
    });
  };

  const handleSignalStatusChange = (pondId: string, signalStatus: RealtimeSignalStatus) => {
    setPonds((current) => {
      return current.map((item) => {
        if (item.id !== pondId) {
          return item;
        }

        if (item.status === "READY") {
          return item;
        }

        if (item.status === signalStatus) {
          return item;
        }

        return {
          ...item,
          status: signalStatus,
        };
      });
    });
  };

  return (
    <AppLayout>
      <div className="container py-6 max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="gradient-ocean text-primary-foreground text-2xl font-bold">NV</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-foreground">Nguyễn Văn A</h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> Cà Mau, Việt Nam
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">3</p>
                  <p className="text-xs text-muted-foreground">Ao tôm</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">128</p>
                  <p className="text-xs text-muted-foreground">Bạn bè</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">6</p>
                  <p className="text-xs text-muted-foreground">Bài viết</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="icon" className="shrink-0">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-5">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "posts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid3x3 className="w-4 h-4" /> Bài viết
          </button>
          <button
            onClick={() => setActiveTab("ponds")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "ponds" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Waves className="w-4 h-4" /> Nhà tôm
          </button>
        </div>

        {/* Content */}
        {activeTab === "posts" ? (
          <div className="grid grid-cols-3 gap-2">
            {userPosts.map((post) => (
              <div key={post.id} className="aspect-square bg-secondary rounded-lg flex items-center justify-center p-3 hover:bg-ocean-light transition-colors cursor-pointer">
                <p className="text-xs text-secondary-foreground text-center font-medium">{post.preview}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ponds.map((pond) => {
              const statusConfig = statusUi[pond.status];

              return (
                <div key={pond.id} className="bg-card rounded-xl border border-border shadow-card p-4 hover:shadow-elevated transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-ocean flex items-center justify-center group-hover:shadow-glow transition-shadow">
                        <Waves className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{pond.name}</p>
                        <p className="text-xs text-muted-foreground">{pond.area} · {pond.location}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/dashboard/${pond.id}`}>Mở dashboard</Link>
                    </Button>
                  </div>

                  {pond.boundDevice && (
                    <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Thiết bị chính của ao</p>
                      <div className="rounded-md border border-border bg-card p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{pond.boundDevice.model}</p>
                          <p className="text-[11px] text-muted-foreground">Serial: {pond.boundDevice.serialNumber}</p>
                        </div>
                        <DeviceSignalStatus
                          lastTelemetryAt={pond.boundDevice.lastTelemetryAt}
                          onStatusChange={(signalStatus) => handleSignalStatusChange(pond.id, signalStatus)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <AddPondModal onCreated={handlePondCreated} />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
