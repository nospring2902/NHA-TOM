import { useEffect, useMemo } from "react";
import {
  Gauge,
  MapPin,
} from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L, { type LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

type PondMarkerStatus = "READY" | "WAITING_SIGNAL" | "ONLINE" | "OFFLINE";

type PondsMapViewPond = {
  id: string;
  name: string;
  location: string;
  status: PondMarkerStatus;
  latitude: number;
  longitude: number;
  score: number | null;
};

type PondsMapViewProps = {
  ponds: PondsMapViewPond[];
  onOpenDashboard: (pondId: string) => void;
  className?: string;
};

const DEFAULT_CENTER: LatLngTuple = [9.1765, 105.1524];

const statusPalette: Record<PondMarkerStatus, { marker: string; glow: string; label: string }> = {
  READY: {
    marker: "#0891b2",
    glow: "rgba(8, 145, 178, 0.45)",
    label: "Sẵn sàng vận hành",
  },
  WAITING_SIGNAL: {
    marker: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.5)",
    label: "Đang đợi tín hiệu",
  },
  ONLINE: {
    marker: "#10b981",
    glow: "rgba(16, 185, 129, 0.5)",
    label: "Đã trực tuyến",
  },
  OFFLINE: {
    marker: "#ef4444",
    glow: "rgba(239, 68, 68, 0.5)",
    label: "Mất tín hiệu",
  },
};

const clampScore = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
};

const formatCoordinate = (value: number): string => {
  return value.toFixed(6);
};

const getScoreAppearance = (score: number | null) => {
  if (score == null) {
    return {
      label: "Chưa có dữ liệu",
      value: "--",
      valueClassName: "text-muted-foreground",
      badgeClassName: "bg-muted text-muted-foreground",
    };
  }

  const normalizedScore = clampScore(Math.round(score));
  if (normalizedScore >= 80) {
    return {
      label: "Mức tốt",
      value: String(normalizedScore),
      valueClassName: "text-emerald-600",
      badgeClassName: "bg-emerald-100 text-emerald-700",
    };
  }

  if (normalizedScore >= 60) {
    return {
      label: "Mức ổn định",
      value: String(normalizedScore),
      valueClassName: "text-cyan-600",
      badgeClassName: "bg-cyan-100 text-cyan-700",
    };
  }

  if (normalizedScore >= 40) {
    return {
      label: "Cần theo dõi",
      value: String(normalizedScore),
      valueClassName: "text-amber-600",
      badgeClassName: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Mức rủi ro",
    value: String(normalizedScore),
    valueClassName: "text-rose-600",
    badgeClassName: "bg-rose-100 text-rose-700",
  };
};

const createMarkerIcon = (status: PondMarkerStatus) => {
  const palette = statusPalette[status];

  return L.divIcon({
    className: "pond-map-marker-container",
    html: `<span class="pond-map-marker-dot" style="--pond-marker-color: ${palette.marker}; --pond-marker-glow: ${palette.glow};"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
};

const FitMapBounds = ({ points }: { points: LatLngTuple[] }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, 11, { animate: false });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.25), { animate: true, duration: 0.8 });
  }, [map, points]);

  return null;
};

export const PondsMapView = ({ ponds, onOpenDashboard, className }: PondsMapViewProps) => {
  const points = useMemo(
    () => ponds.map((pond): LatLngTuple => [pond.latitude, pond.longitude]),
    [ponds],
  );

  const markerIcons = useMemo(
    () => ({
      READY: createMarkerIcon("READY"),
      WAITING_SIGNAL: createMarkerIcon("WAITING_SIGNAL"),
      ONLINE: createMarkerIcon("ONLINE"),
      OFFLINE: createMarkerIcon("OFFLINE"),
    }),
    [],
  );

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border shadow-elevated", className)}>
      <div className="pointer-events-none absolute inset-0 z-[300] bg-gradient-to-br from-ocean/12 via-transparent to-aqua/12" />
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={11}
        className="h-[500px] w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          className="pond-map-tile-layer"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMapBounds points={points} />

        {ponds.map((pond) => {
          const scoreAppearance = getScoreAppearance(pond.score);

          return (
            <Marker
              key={pond.id}
              position={[pond.latitude, pond.longitude]}
              icon={markerIcons[pond.status]}
              eventHandlers={{
                mouseover: (event) => {
                  event.target.openPopup();
                },
                mouseout: (event) => {
                  event.target.closePopup();
                },
                click: () => {
                  onOpenDashboard(pond.id);
                },
              }}
            >
              <Popup className="pond-map-popup" closeButton={false}>
                <div className="w-[260px] rounded-xl border border-border bg-card p-3 shadow-elevated">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{pond.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>Lng: {formatCoordinate(pond.longitude)} | Lat: {formatCoordinate(pond.latitude)}</span>
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: statusPalette[pond.status].marker }}
                    >
                      {statusPalette[pond.status].label}
                    </span>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/35 p-2.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Water Score 
                    </p>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{scoreAppearance.label}</p>
                          {/* <p className="text-[10px] text-muted-foreground">Theo dữ liệu realtime dashboard</p> */}
                        </div>
                      </div>
                      <p className={`text-2xl font-bold ${scoreAppearance.valueClassName}`}>{scoreAppearance.value}</p>
                    </div>
                    {/* <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${scoreAppearance.badgeClassName}`}>
                      Cập nhật từ score tổng hợp
                    </span> */}
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDashboard(pond.id);
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md gradient-ocean px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-[1px]"
                  >
                    {/* <Waves className="h-3.5 w-3.5" /> */}
                    Mở dashboard ao
                    {/* <ExternalLink className="h-3.5 w-3.5" /> */}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
