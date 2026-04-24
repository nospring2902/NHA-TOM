import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Grid3x3, Waves, Settings, MapPin, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AddPondModal } from "@/components/AddPondModal";
import { DeviceSignalStatus } from "@/components/DeviceSignalStatus";
import {
  BoundDevice,
  CreatePondAndBindResult,
  getApiErrorMessage,
  getTelemetryStatus,
} from "@/lib/device-binding";
import { type RealtimeSignalStatus } from "@/lib/device-status";
import { getAuthSession } from "@/lib/auth";
import { http } from "@/lib/http";
import { getDashboardRealtime, type RealtimeDevice } from "@/lib/dashboard";
import AppLayout from "@/components/AppLayout";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

type ProfilePost = {
  id: string;
  preview: string;
};

type PostRow = {
  id: string;
  content: string;
  author: {
    id: string;
  };
};

type PondRow = {
  id: string;
  name: string;
  areaM2: number;
  location: string;
};

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

const truncate = (value: string, maxLength: number): string => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

const mapDeviceStatusToPondStatus = (status: RealtimeDevice["status"]): PondSetupStatus => {
  if (status === "ONLINE") {
    return "ONLINE";
  }

  if (status === "OFFLINE" || status === "ERROR" || status === "MAINTENANCE") {
    return "OFFLINE";
  }

  return "WAITING_SIGNAL";
};

const toBoundDevice = (pondId: string, device: RealtimeDevice): BoundDevice => {
  return {
    id: device.id,
    pondId,
    serialNumber: device.serialNumber,
    model: device.model,
    type: device.type,
    status: device.status,
    telemetryPackets: device.telemetryPackets,
    boundAt: device.boundAt,
    lastTelemetryAt: device.lastTelemetryAt,
  };
};

const getDeviceStatusText = (status: BoundDevice["status"]): string => {
  if (status === "ONLINE") {
    return "Thiết bị đang trực tuyến";
  }

  if (status === "OFFLINE") {
    return "Thiết bị đang mất tín hiệu";
  }

  if (status === "WAITING_SIGNAL") {
    return "Thiết bị đang đợi tín hiệu đầu tiên";
  }

  if (status === "ERROR") {
    return "Thiết bị đang báo lỗi";
  }

  if (status === "MAINTENANCE") {
    return "Thiết bị đang bảo trì";
  }

  return "Thiết bị chưa kích hoạt";
};

const ProfilePage = () => {
  const session = getAuthSession();
  const currentUserId = session?.user.id ?? null;

  const [activeTab, setActiveTab] = useState<"posts" | "ponds">("posts");
  const [ponds, setPonds] = useState<ProfilePond[]>([]);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [isLoadingPonds, setIsLoadingPonds] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [pondLoadError, setPondLoadError] = useState<string | null>(null);
  const [postLoadError, setPostLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPonds = async () => {
      setIsLoadingPonds(true);
      setPondLoadError(null);

      try {
        const pondResponse = await http.get<ApiEnvelope<PondRow[]>>("/ponds");
        const pondRows = pondResponse.data.data;

        const dashboardResponses = await Promise.allSettled(
          pondRows.map(async (pond) => {
            const dashboard = await getDashboardRealtime(pond.id);
            return {
              pondId: pond.id,
              devices: dashboard.data.devices,
            };
          }),
        );

        if (!isMounted) {
          return;
        }

        const devicesByPondId = new Map<string, RealtimeDevice[]>();
        for (const result of dashboardResponses) {
          if (result.status !== "fulfilled") {
            continue;
          }

          devicesByPondId.set(result.value.pondId, result.value.devices);
        }

        const mapped = pondRows.map((pond) => {
          const area = `${pond.areaM2.toLocaleString("vi-VN")} m²`;
          const devices = devicesByPondId.get(pond.id) ?? [];
          const primaryDevice = devices[0];

          if (!primaryDevice) {
            return {
              id: pond.id,
              name: pond.name,
              area,
              location: pond.location,
              status: "READY" as PondSetupStatus,
            };
          }

          const boundDevice = toBoundDevice(pond.id, primaryDevice);
          return {
            id: pond.id,
            name: pond.name,
            area,
            location: pond.location,
            status: mapDeviceStatusToPondStatus(primaryDevice.status),
            boundDevice,
          };
        });

        setPonds(mapped);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPondLoadError(getApiErrorMessage(error, "Không tải được danh sách nhà tôm"));
      } finally {
        if (isMounted) {
          setIsLoadingPonds(false);
        }
      }
    };

    const loadPosts = async () => {
      setIsLoadingPosts(true);
      setPostLoadError(null);

      try {
        const response = await http.get<ApiEnvelope<PostRow[]>>("/posts", {
          params: {
            page: 1,
            limit: 50,
          },
        });

        if (!isMounted) {
          return;
        }

        const filtered = currentUserId
          ? response.data.data.filter((post) => post.author.id === currentUserId)
          : response.data.data;

        setPosts(
          filtered.map((post) => ({
            id: post.id,
            preview: truncate(post.content, 58),
          })),
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPostLoadError(getApiErrorMessage(error, "Không tải được danh sách bài viết"));
      } finally {
        if (isMounted) {
          setIsLoadingPosts(false);
        }
      }
    };

    void Promise.all([loadPonds(), loadPosts()]);

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

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
            status: mapDeviceStatusToPondStatus(nextStatus.status),
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

  const handleSignalStatusChange = useCallback((pondId: string, signalStatus: RealtimeSignalStatus) => {
    setPonds((current) => {
      let hasChanges = false;

      const next = current.map((item) => {
        if (item.id !== pondId) {
          return item;
        }

        if (item.status === "READY") {
          return item;
        }

        if (item.status === signalStatus) {
          return item;
        }

        hasChanges = true;

        return {
          ...item,
          status: signalStatus,
        };
      });

      return hasChanges ? next : current;
    });
  }, []);

  return (
    <AppLayout>
      <div className="container py-6 max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="gradient-ocean text-primary-foreground text-2xl font-bold">
                {(session?.user.fullName ?? "Người dùng")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-foreground">
                {session?.user.fullName ?? "Người dùng"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> {ponds[0]?.location ?? "Chưa cập nhật khu vực"}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{ponds.length}</p>
                  <p className="text-xs text-muted-foreground">Ao tôm</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">--</p>
                  <p className="text-xs text-muted-foreground">Bạn bè</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{posts.length}</p>
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
            {isLoadingPosts && (
              <div className="col-span-3 flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải bài viết...
              </div>
            )}

            {!isLoadingPosts && postLoadError && (
              <div className="col-span-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {postLoadError}
              </div>
            )}

            {!isLoadingPosts && !postLoadError && posts.length === 0 && (
              <div className="col-span-3 rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground text-center">
                Bạn chưa có bài viết nào.
              </div>
            )}

            {!isLoadingPosts && !postLoadError &&
              posts.map((post) => (
                <div
                  key={post.id}
                  className="aspect-square bg-secondary rounded-lg flex items-center justify-center p-3 hover:bg-ocean-light transition-colors cursor-pointer"
                >
                  <p className="text-xs text-secondary-foreground text-center font-medium">{post.preview}</p>
                </div>
              ))}
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingPonds && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải nhà tôm...
              </div>
            )}

            {!isLoadingPonds && pondLoadError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {pondLoadError}
              </div>
            )}

            {!isLoadingPonds && !pondLoadError && ponds.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground text-center">
                Chưa có nhà tôm nào. Hãy tạo nhà tôm đầu tiên.
              </div>
            )}

            {!isLoadingPonds && !pondLoadError && ponds.map((pond) => {
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
                        <p
                          className={`mt-1 text-xs font-medium ${
                            pond.boundDevice.status === "OFFLINE"
                              ? "text-destructive"
                              : pond.boundDevice.status === "ONLINE"
                                ? "text-aqua"
                                : "text-muted-foreground"
                          }`}
                        >
                          {getDeviceStatusText(pond.boundDevice.status)}
                        </p>
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
