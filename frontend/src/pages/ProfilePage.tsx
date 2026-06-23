import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Grid3x3, Waves, Settings, MapPin, Loader2, List, Map as MapIcon, Users, Check, X, Building2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AddPondModal } from "@/components/AddPondModal";
import { DeviceSignalStatus } from "@/components/DeviceSignalStatus";
import { PondsMapView } from "@/components/PondsMapView";
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
import { useRealtime } from "@/contexts/RealtimeContext";
import {
  listMyInvites,
  acceptInvite,
  rejectInvite,
  type FarmInvite,
} from "@/lib/collaboration";
import { toast } from "@/hooks/use-toast";
import { MembersPanel } from "@/components/MembersPanel";
import { TaskBoard } from "@/components/TaskBoard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

type ProfileUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
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
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  geo?: {
    lat: number;
    lng: number;
  } | null;
  isCollaborative?: boolean;
  ownerName?: string;
};

type PondSetupStatus = "READY" | RealtimeSignalStatus;
type PondViewMode = "list" | "map";

type ProfilePond = {
  id: string;
  name: string;
  area: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  score: number | null;
  status: PondSetupStatus;
  boundDevice?: BoundDevice;
  isCollaborative?: boolean;
  ownerName?: string;
};

type PondCoordinateSource = {
  id: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  geo?: {
    lat: number;
    lng: number;
  } | null;
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

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const hasValidCoordinatePair = (latitude: unknown, longitude: unknown): boolean => {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return false;
  }

  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

const resolvePondCoordinates = (
  source: PondCoordinateSource,
): { latitude: number; longitude: number } | null => {
  if (hasValidCoordinatePair(source.latitude, source.longitude)) {
    return {
      latitude: source.latitude,
      longitude: source.longitude,
    };
  }

  if (hasValidCoordinatePair(source.lat, source.lng)) {
    return {
      latitude: source.lat,
      longitude: source.lng,
    };
  }

  if (source.geo && hasValidCoordinatePair(source.geo.lat, source.geo.lng)) {
    return {
      latitude: source.geo.lat,
      longitude: source.geo.lng,
    };
  }

  return null;
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
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const currentUserId = profileUser?.id ?? session?.user.id ?? null;

  const [activeTab, setActiveTab] = useState<"posts" | "ponds" | "farm">("ponds");
  const [pondViewMode, setPondViewMode] = useState<PondViewMode>("list");
  const [ponds, setPonds] = useState<ProfilePond[]>([]);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [isLoadingPonds, setIsLoadingPonds] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [pondLoadError, setPondLoadError] = useState<string | null>(null);
  const [postLoadError, setPostLoadError] = useState<string | null>(null);
  const [pondTotal, setPondTotal] = useState<number | null>(null);
  const [postTotal, setPostTotal] = useState<number | null>(null);
  const [selectedPondIdForTasks, setSelectedPondIdForTasks] = useState<string>("");

  const { socket } = useRealtime();
  const [invites, setInvites] = useState<FarmInvite[]>([]);
  const [isInvitesLoading, setIsInvitesLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    setIsInvitesLoading(true);
    try {
      const response = await listMyInvites();
      setInvites(response.data);
    } catch {
      // silent
    } finally {
      setIsInvitesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  useEffect(() => {
    if (!socket) return;
    const handleNewInvite = () => {
      void fetchInvites();
    };
    socket.on("farm:invite", handleNewInvite);
    return () => {
      socket.off("farm:invite", handleNewInvite);
    };
  }, [socket, fetchInvites]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError(null);

      try {
        const response = await http.get<ApiEnvelope<ProfileUser>>("/users/me");

        if (!isMounted) {
          return;
        }

        setProfileUser(response.data.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProfileError(getApiErrorMessage(error, "Không tải được thông tin tài khoản"));
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPonds = async () => {
      setIsLoadingPonds(true);
      setPondLoadError(null);

      try {
        const pondResponse = await http.get<ApiEnvelope<PondRow[]>>("/ponds");
        const pondRows = pondResponse.data.data;
        const totalPonds =
          typeof pondResponse.data.meta?.total === "number"
            ? pondResponse.data.meta.total
            : pondRows.length;

        const dashboardResponses = await Promise.allSettled(
          pondRows.map(async (pond) => {
            const dashboard = await getDashboardRealtime(pond.id);
            return {
              pondId: pond.id,
              devices: dashboard.data.devices,
              score: dashboard.data.score,
            };
          }),
        );

        if (!isMounted) {
          return;
        }

        const devicesByPondId = new Map<string, RealtimeDevice[]>();
        const scoreByPondId = new Map<string, number | null>();
        for (const result of dashboardResponses) {
          if (result.status !== "fulfilled") {
            continue;
          }

          devicesByPondId.set(result.value.pondId, result.value.devices);
          scoreByPondId.set(result.value.pondId, result.value.score);
        }

        const mapped = pondRows.map((pond) => {
          const area = `${pond.areaM2.toLocaleString("vi-VN")} m²`;
          const devices = devicesByPondId.get(pond.id) ?? [];
          const primaryDevice = devices[0];
          const coordinates = resolvePondCoordinates(pond);
          const score = scoreByPondId.get(pond.id) ?? null;

          if (!primaryDevice) {
            return {
              id: pond.id,
              name: pond.name,
              area,
              location: pond.location,
              latitude: coordinates?.latitude ?? null,
              longitude: coordinates?.longitude ?? null,
              score,
              status: "READY" as PondSetupStatus,
              isCollaborative: pond.isCollaborative,
              ownerName: pond.ownerName,
            };
          }

          const boundDevice = toBoundDevice(pond.id, primaryDevice);
          return {
            id: pond.id,
            name: pond.name,
            area,
            location: pond.location,
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
            score,
            status: mapDeviceStatusToPondStatus(primaryDevice.status),
            boundDevice,
            isCollaborative: pond.isCollaborative,
            ownerName: pond.ownerName,
          };
        });

        setPonds(mapped);
        setPondTotal(totalPonds);
        const ownedPonds = mapped.filter((p) => !p.isCollaborative);
        if (ownedPonds.length > 0 && !selectedPondIdForTasks) {
          setSelectedPondIdForTasks(ownedPonds[0].id);
        }
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
            mine: true,
          },
        });

        if (!isMounted) {
          return;
        }

        const totalPosts =
          typeof response.data.meta?.total === "number"
            ? response.data.meta.total
            : response.data.data.length;

        setPosts(
          response.data.data.map((post) => ({
            id: post.id,
            preview: truncate(post.content, 58),
          })),
        );
        setPostTotal(totalPosts);
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

  const pondIdsKey = useMemo(() => ponds.map((pond) => pond.id).sort().join("|"), [ponds]);

  useEffect(() => {
    if (!pondIdsKey) {
      return;
    }

    const activePondIds = pondIdsKey.split("|");

    let isMounted = true;

    const syncCoordinatesAndScores = async () => {
      const [pondRowsResult, dashboardResult] = await Promise.allSettled([
        http.get<ApiEnvelope<PondRow[]>>("/ponds"),
        Promise.allSettled(
          activePondIds.map(async (pondId) => {
            const dashboard = await getDashboardRealtime(pondId);
            return {
              pondId,
              score: dashboard.data.score,
            };
          }),
        ),
      ]);

      if (!isMounted) {
        return;
      }

      const coordinatesByPondId = new Map<
        string,
        {
          location: string;
          latitude: number | null;
          longitude: number | null;
        }
      >();

      if (pondRowsResult.status === "fulfilled") {
        for (const pond of pondRowsResult.value.data.data) {
          const coordinates = resolvePondCoordinates(pond);
          coordinatesByPondId.set(pond.id, {
            location: pond.location,
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
          });
        }
      }

      const scoreByPondId = new Map<string, number | null>();
      if (dashboardResult.status === "fulfilled") {
        for (const item of dashboardResult.value) {
          if (item.status !== "fulfilled") {
            continue;
          }

          scoreByPondId.set(item.value.pondId, item.value.score);
        }
      }

      if (coordinatesByPondId.size === 0 && scoreByPondId.size === 0) {
        return;
      }

      setPonds((current) => {
        let hasChanges = false;

        const next = current.map((pond) => {
          const nextCoordinates = coordinatesByPondId.get(pond.id);
          const hasScore = scoreByPondId.has(pond.id);
          const nextScore = hasScore ? (scoreByPondId.get(pond.id) ?? null) : pond.score;

          const location = nextCoordinates?.location ?? pond.location;
          const latitude = nextCoordinates?.latitude ?? pond.latitude;
          const longitude = nextCoordinates?.longitude ?? pond.longitude;

          if (
            location === pond.location &&
            latitude === pond.latitude &&
            longitude === pond.longitude &&
            nextScore === pond.score
          ) {
            return pond;
          }

          hasChanges = true;
          return {
            ...pond,
            location,
            latitude,
            longitude,
            score: nextScore,
          };
        });

        return hasChanges ? next : current;
      });
    };

    void syncCoordinatesAndScores();
    const timer = window.setInterval(() => {
      void syncCoordinatesAndScores();
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [pondIdsKey]);

  const handlePondCreated = (result: CreatePondAndBindResult) => {
    setPonds((current) => {
      const withoutDuplicated = current.filter((item) => item.id !== result.pond.id);
      const coordinates = resolvePondCoordinates({
        id: result.pond.id,
        location: result.pond.location,
        latitude: result.pond.latitude,
        longitude: result.pond.longitude,
      });

      return [
        {
          id: result.pond.id,
          name: result.pond.name,
          area: `${result.pond.areaM2.toLocaleString("vi-VN")} m²`,
          location: result.pond.location,
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
          score: null,
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

  const handleOpenDashboard = useCallback(
    (pondId: string) => {
      navigate(`/dashboard/${pondId}`);
    },
    [navigate],
  );

  const pondsWithCoordinates = useMemo(() => {
    return ponds.filter(
      (
        pond,
      ): pond is ProfilePond & {
        latitude: number;
        longitude: number;
      } => hasValidCoordinatePair(pond.latitude, pond.longitude),
    );
  }, [ponds]);

  const pondsMissingCoordinatesCount = ponds.length - pondsWithCoordinates.length;
  const displayName = profileUser?.fullName ?? session?.user.fullName ?? "Người dùng";
  const pondsCount = pondTotal ?? ponds.length;
  const postsCount = postTotal ?? posts.length;

  return (
    <AppLayout>
      <div className="container py-6 max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="gradient-ocean text-primary-foreground text-2xl font-bold">
                {displayName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-foreground">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> {ponds[0]?.location ?? "Chưa cập nhật khu vực"}
              </p>
              {isLoadingProfile && !profileUser && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tải hồ sơ...
                </p>
              )}
              {profileError && (
                <p className="text-xs text-destructive mt-2">{profileError}</p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{pondsCount}</p>
                  <p className="text-xs text-muted-foreground">Ao tôm</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">--</p>
                  <p className="text-xs text-muted-foreground">Bạn bè</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{postsCount}</p>
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
          <button
            onClick={() => setActiveTab("farm")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "farm" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" /> Nhóm & Nhiệm vụ
          </button>
        </div>

        {/* Content */}
        {activeTab === "posts" && (
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
        )}

        {activeTab === "ponds" && (
          <div className="space-y-3">
            {/* Lời mời cộng tác */}
            {!isInvitesLoading && invites.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-card p-4 mb-6">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Lời mời cộng tác ({invites.length})
                </h3>
                <div className="space-y-2">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{invite.owner.fullName}</p>
                        <p className="text-xs text-muted-foreground">Mời bạn cùng quản lý Farm</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8 gap-1"
                          onClick={async () => {
                            try {
                              await acceptInvite(invite.id);
                              setInvites((prev) => prev.filter((i) => i.id !== invite.id));
                              toast({ title: "Đã chấp nhận lời mời" });
                              window.location.reload();
                            } catch (e) {
                              toast({ title: "Lỗi", description: "Không thể nhận lời mời", variant: "destructive" });
                            }
                          }}
                        >
                          <Check className="h-3.5 w-3.5" /> Đồng ý
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={async () => {
                            try {
                              await rejectInvite(invite.id);
                              setInvites((prev) => prev.filter((i) => i.id !== invite.id));
                              toast({ title: "Đã từ chối lời mời" });
                            } catch (e) {
                              toast({ title: "Lỗi", description: "Không thể từ chối lời mời", variant: "destructive" });
                            }
                          }}
                        >
                          <X className="h-3.5 w-3.5" /> Từ chối
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 shadow-card">
                <button
                  type="button"
                  onClick={() => setPondViewMode("list")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    pondViewMode === "list"
                      ? "gradient-ocean text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Dạng danh sách
                </button>
                <button
                  type="button"
                  onClick={() => setPondViewMode("map")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    pondViewMode === "map"
                      ? "gradient-ocean text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Dạng bản đồ
                </button>
              </div>
            </div>

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

            {!isLoadingPonds && !pondLoadError && ponds.length > 0 && pondViewMode === "map" && (
              <>
                {pondsWithCoordinates.length > 0 ? (
                  <PondsMapView ponds={pondsWithCoordinates} onOpenDashboard={handleOpenDashboard} />
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground text-center">
                    Chưa có tọa độ từ ThingsBoard. Bật simulator hoặc chờ telemetry mới để hiển thị marker.
                  </div>
                )}

                {pondsMissingCoordinatesCount > 0 && (
                  <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                    {pondsMissingCoordinatesCount} ao chưa có vị trí telemetry từ ThingsBoard nên tạm thời chưa hiển thị trên bản đồ.
                  </div>
                )}
              </>
            )}

            {!isLoadingPonds && !pondLoadError && pondViewMode === "list" && ponds.map((pond) => {
              const statusConfig = statusUi[pond.status];

              return (
                <div key={pond.id} className="bg-card rounded-xl border border-border shadow-card p-4 hover:shadow-elevated transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-ocean flex items-center justify-center group-hover:shadow-glow transition-shadow">
                        <Waves className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{pond.name}</p>
                          {pond.isCollaborative && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                              Cộng tác
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {pond.area} · {pond.location}
                          {pond.isCollaborative && pond.ownerName && ` · Owner: ${pond.ownerName}`}
                        </p>
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

        {activeTab === "farm" && (
          <div className="space-y-6">
            <MembersPanel isOwner={true} />

            <div className="bg-card rounded-xl border border-border shadow-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Nhiệm vụ theo ao
                </h3>
                <div className="flex items-center gap-2">
                  <Select value={selectedPondIdForTasks} onValueChange={setSelectedPondIdForTasks}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Chọn ao..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ponds.filter(p => !p.isCollaborative).map(pond => (
                        <SelectItem key={pond.id} value={pond.id}>
                          {pond.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedPondIdForTasks ? (
                <div className="mt-4 border-t border-border pt-4">
                  <TaskBoard pondId={selectedPondIdForTasks} isOwner={true} />
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-border">
                  Vui lòng tạo ít nhất một nhà tôm để quản lý nhiệm vụ.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
