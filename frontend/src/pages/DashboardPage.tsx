import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Droplets, Thermometer, Wind, Gauge, Power, ArrowLeft, CloudRain, Sun, AlertTriangle, Download, Activity, CheckCircle2, Bot, CalendarClock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AddDeviceModal } from "@/components/AddDeviceModal";
import { BoundDevice, getApiErrorMessage } from "@/lib/device-binding";
import { DashboardRealtime, getDashboardRealtime } from "@/lib/dashboard";

const STATUS_LABEL: Record<BoundDevice["status"], string> = {
  INACTIVE: "Chưa kích hoạt",
  WAITING_SIGNAL: "Đang chờ tín hiệu",
  ONLINE: "Đang trực tuyến",
  OFFLINE: "Mất tín hiệu",
  ERROR: "Lỗi thiết bị",
  MAINTENANCE: "Bảo trì",
};

const SCORE_LABEL: Record<DashboardRealtime["level"], string> = {
  unknown: "Chưa có dữ liệu",
  excellent: "Rất tốt",
  good: "Tốt",
  fair: "Trung bình",
  poor: "Kém",
};

const SCORE_BADGE_CLASS: Record<DashboardRealtime["level"], string> = {
  unknown: "text-muted-foreground bg-muted",
  excellent: "text-aqua bg-aqua-light",
  good: "text-aqua bg-aqua-light",
  fair: "text-coral bg-coral/10",
  poor: "text-destructive bg-destructive/10",
};

type WaterQualityForecast = {
  horizon: "tomorrow" | "next_3_days" | "next_7_days";
  label: string;
  level: DashboardRealtime["level"];
  score: number | null;
  confidence: number;
  trend: "up" | "down" | "stable";
  summary: string;
  note: string;
  risks: string[];
};

const FORECAST_TREND_LABEL: Record<WaterQualityForecast["trend"], string> = {
  up: "Cải thiện",
  down: "Giảm",
  stable: "Ổn định",
};

const FORECAST_TREND_CLASS: Record<WaterQualityForecast["trend"], string> = {
  up: "text-aqua",
  down: "text-coral",
  stable: "text-muted-foreground",
};

const FORECAST_TREND_ICON: Record<WaterQualityForecast["trend"], typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const mockForecasts: WaterQualityForecast[] = [
  {
    horizon: "tomorrow",
    label: "Ngày mai",
    level: "good",
    score: 78,
    confidence: 82,
    trend: "up",
    summary: "Ổn định, ít dao động",
    note: "Oxy hòa tan giữ mức tốt, nhiệt độ dịu hơn buổi trưa.",
    risks: ["Mưa rào nhẹ", "Tăng đột biến pH buổi chiều"],
  },
  {
    horizon: "next_3_days",
    label: "3 ngày tới",
    level: "fair",
    score: 68,
    confidence: 71,
    trend: "stable",
    summary: "Dao động nhẹ, cần theo dõi",
    note: "Khả năng mưa lớn làm giảm độ mặn và nhiệt độ vào chiều tối.",
    risks: ["Gió mạnh", "DO giảm ban đêm"],
  },
  {
    horizon: "next_7_days",
    label: "7 ngày tới",
    level: "poor",
    score: 54,
    confidence: 63,
    trend: "down",
    summary: "Rủi ro tăng",
    note: "Nhiệt độ và độ mặn biến động, cần kế hoạch sục khí bổ sung.",
    risks: ["Nắng nóng kéo dài", "Tăng amoniac"],
  },
];

const activityLog = [
  { time: "20:15", action: "Máy sục khí BẬT", trigger: "Oxy thấp (tự động)" },
  { time: "18:00", action: "Đèn ao BẬT", trigger: "Lịch hẹn giờ" },
  { time: "14:30", action: "Bơm nước TẮT", trigger: "Thủ công" },
];

const DashboardPage = () => {
  const { id } = useParams();
  const pondId = id ?? "1";
  const [aerator, setAerator] = useState(true);
  const [pump, setPump] = useState(false);
  const [light, setLight] = useState(true);
  const [activeChart, setActiveChart] = useState<"pH" | "DO" | "temp">("pH");
  const [boundDevices, setBoundDevices] = useState<BoundDevice[]>([]);
  const [realtime, setRealtime] = useState<DashboardRealtime | null>(null);
  const [isRealtimeLoading, setIsRealtimeLoading] = useState(true);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const pollRealtime = async (silent: boolean) => {
      if (!silent && mounted) {
        setIsRealtimeLoading(true);
      }

      try {
        const response = await getDashboardRealtime(pondId);
        if (!mounted) {
          return;
        }

        setRealtime(response.data);
        setBoundDevices(
          response.data.devices.map((device) => ({
            id: device.id,
            pondId,
            serialNumber: device.serialNumber,
            model: device.model,
            type: String(device.type).toLowerCase(),
            status: device.status,
            telemetryPackets: device.telemetryPackets,
            boundAt: device.boundAt,
            lastTelemetryAt: device.lastTelemetryAt,
          })),
        );
        setRealtimeError(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setRealtimeError(getApiErrorMessage(error, "Không thể tải dữ liệu dashboard realtime"));
      } finally {
        if (mounted && !silent) {
          setIsRealtimeLoading(false);
        }
      }
    };

    void pollRealtime(false);

    const timer = window.setInterval(() => {
      void pollRealtime(true);
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pondId]);

  const handleDeviceBoundSuccess = (device: BoundDevice) => {
    setBoundDevices((current) => {
      const withoutDuplicated = current.filter((item) => item.id !== device.id);
      return [device, ...withoutDuplicated];
    });
  };

  const formatMetric = (value: number | null | undefined, suffix: string, digits = 1) => {
    if (value == null) {
      return `--${suffix}`;
    }

    return `${value.toFixed(digits)}${suffix}`;
  };

  const latestMetric = realtime?.latestMetric ?? null;

  const sensorCards = useMemo(
    () => [
      {
        label: "Nhiệt độ",
        value: formatMetric(latestMetric?.temperature, "°C", 1),
        icon: Thermometer,
        color: "text-coral",
        status: latestMetric?.temperature != null ? "Realtime" : "Chưa có dữ liệu",
      },
      {
        label: "pH",
        value: formatMetric(latestMetric?.ph, "", 2),
        icon: Droplets,
        color: "text-primary",
        status: latestMetric?.ph != null ? "Realtime" : "Chưa có dữ liệu",
      },
      {
        label: "Oxy hòa tan",
        value: formatMetric(latestMetric?.dissolvedOxygen, " mg/L", 2),
        icon: Wind,
        color: "text-aqua",
        status: latestMetric?.dissolvedOxygen != null ? "Realtime" : "Chưa có dữ liệu",
      },
      {
        label: "Độ mặn",
        value: formatMetric(latestMetric?.salinity, "‰", 2),
        icon: Gauge,
        color: "text-wave",
        status: latestMetric?.salinity != null ? "Realtime" : "Chưa có dữ liệu",
      },
    ],
    [latestMetric],
  );

  const chartData = useMemo(
    () =>
      (realtime?.metricsHistory ?? []).map((point) => ({
        time: new Date(point.measuredAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        pH: point.ph,
        DO: point.dissolvedOxygen,
        temp: point.temperature,
      })),
    [realtime?.metricsHistory],
  );

  const alerts = useMemo(() => {
    const realtimeAlerts: Array<{ type: "warning" | "info"; message: string; time: string }> = [];

    if (latestMetric?.dissolvedOxygen != null && latestMetric.dissolvedOxygen < 5) {
      realtimeAlerts.push({
        type: "warning",
        message: "Oxy hòa tan thấp, cân nhắc bật sục khí",
        time: "Theo dữ liệu telemetry mới nhất",
      });
    }

    if (latestMetric?.temperature != null && latestMetric.temperature > 31) {
      realtimeAlerts.push({
        type: "warning",
        message: "Nhiệt độ cao hơn ngưỡng khuyến nghị",
        time: "Theo dữ liệu telemetry mới nhất",
      });
    }

    if (realtimeAlerts.length === 0) {
      realtimeAlerts.push({
        type: "info",
        message: "Chỉ số đang ổn định trong ngưỡng an toàn",
        time: "Cập nhật realtime mỗi 5 giây",
      });
    }

    return realtimeAlerts;
  }, [latestMetric]);

  const chartConfig = {
    pH: { key: "pH", color: "hsl(195, 85%, 35%)", label: "pH" },
    DO: { key: "DO", color: "hsl(170, 70%, 40%)", label: "Oxy hòa tan (mg/L)" },
    temp: { key: "temp", color: "hsl(12, 80%, 60%)", label: "Nhiệt độ (°C)" },
  };

  const active = chartConfig[activeChart];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/90 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-bold text-foreground">Ao Tôm A{pondId}</h1>
              <p className="text-xs text-muted-foreground">2,000 m² · Cà Mau</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
            <Download className="w-3.5 h-3.5" /> Xuất CSV
          </Button>
        </div>
      </header>

      <div className="container py-6 space-y-6 max-w-6xl">
        {/* Water Quality Score */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Chỉ số chất lượng nước</h2>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                SCORE_BADGE_CLASS[realtime?.level ?? "unknown"]
              }`}
            >
              {SCORE_LABEL[realtime?.level ?? "unknown"]}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-primary">
              {realtime?.score ?? "--"}
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <div className="flex-1">
              <Progress
                value={realtime?.score ?? 0}
                className="h-3 bg-secondary [&>div]:gradient-ocean"
              />
            </div>
          </div>
          {latestMetric?.measuredAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Cập nhật gần nhất: {new Date(latestMetric.measuredAt).toLocaleString("vi-VN")}
            </p>
          )}
          {realtimeError && <p className="mt-2 text-xs text-destructive">{realtimeError}</p>}
          {isRealtimeLoading && !realtime && (
            <p className="mt-2 text-xs text-muted-foreground">Đang tải dữ liệu telemetry realtime...</p>
          )}
        </div>

        {/* Forecast */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Dự đoán chất lượng nước</h2>
              <p className="text-xs text-muted-foreground">Mock data để xem giao diện trước khi tích hợp AI</p>
            </div>
            <CalendarClock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {mockForecasts.map((forecast) => {
              const TrendIcon = FORECAST_TREND_ICON[forecast.trend];
              return (
                <div key={forecast.horizon} className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{forecast.label}</p>
                    <span
                      className={`text-[10px] font-medium px-2 py-1 rounded-full ${SCORE_BADGE_CLASS[forecast.level]}`}
                    >
                      {SCORE_LABEL[forecast.level]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {forecast.score ?? "--"}
                        <span className="text-xs text-muted-foreground">/100</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{forecast.summary}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${FORECAST_TREND_CLASS[forecast.trend]}`}>
                      <TrendIcon className="w-4 h-4" />
                      {FORECAST_TREND_LABEL[forecast.trend]}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{forecast.note}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {forecast.risks.map((risk) => (
                      <span key={risk} className="text-[10px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sensor cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {sensorCards.map((s) => (
            <div key={s.label} className="bg-card rounded-xl border border-border shadow-card p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <span className="text-xs text-aqua font-medium">{s.status}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts + Alerts row */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          {/* Chart */}
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Biểu đồ theo thời gian</h2>
              <div className="flex gap-1">
                {(["pH", "DO", "temp"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveChart(key)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeChart === key ? "gradient-ocean text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {chartConfig[key].label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                Chưa có dữ liệu lịch sử telemetry
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 20%, 90%)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(210, 15%, 45%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(210, 15%, 45%)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0, 0%, 100%)",
                      border: "1px solid hsl(200, 20%, 90%)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={active.key}
                    stroke={active.color}
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Alerts */}
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-coral" /> Dự đoán & Cảnh báo
              </h3>
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className={`rounded-lg p-3 text-xs ${a.type === "warning" ? "bg-coral/10 text-coral" : "bg-aqua-light text-secondary-foreground"}`}>
                    <p className="font-medium">{a.message}</p>
                    <p className="mt-0.5 opacity-70">{a.time}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weather */}
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Thời tiết</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Sun, label: "Nhiệt độ", value: "32°C" },
                  { icon: CloudRain, label: "Mưa", value: "20%" },
                  { icon: Wind, label: "Gió", value: "12 km/h" },
                  { icon: Gauge, label: "Áp suất", value: "1013 hPa" },
                ].map((w) => (
                  <div key={w.label} className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                    <w.icon className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{w.label}</p>
                      <p className="text-xs font-semibold text-foreground">{w.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Device controls + Activity log */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Devices */}
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Power className="w-4 h-4 text-primary" /> Điều khiển thiết bị
            </h2>
            <div className="space-y-3">
              {[
                { label: "Máy sục khí", active: aerator, toggle: () => setAerator(!aerator), auto: true },
                { label: "Bơm nước", active: pump, toggle: () => setPump(!pump), auto: false },
                { label: "Đèn ao", active: light, toggle: () => setLight(!light), auto: true },
              ].map((d) => (
                <div key={d.label} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.auto ? "Tự động" : "Thủ công"}</p>
                  </div>
                  <button
                    onClick={d.toggle}
                    className={`w-12 h-7 rounded-full transition-colors relative ${d.active ? "bg-aqua" : "bg-border"}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-card rounded-full shadow transition-transform ${d.active ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Thiết bị IoT đã kết nối</p>
                  <p className="text-xs text-muted-foreground">Kết nối thiết bị bằng Serial để nhận dữ liệu telemetry.</p>
                </div>
                <AddDeviceModal pondId={pondId} onBoundSuccess={handleDeviceBoundSuccess} />
              </div>

              {boundDevices.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Chưa có thiết bị nào được bind thủ công cho ao này.
                </div>
              ) : (
                <div className="space-y-3">
                  {boundDevices.map((device) => (
                    <div key={device.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{device.model}</p>
                          <p className="text-xs text-muted-foreground tracking-wide">Serial: {device.serialNumber}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                          {STATUS_LABEL[device.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {device.lastTelemetryAt
                          ? `Telemetry gần nhất: ${new Date(device.lastTelemetryAt).toLocaleString("vi-VN")}`
                          : "Chưa nhận telemetry"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div> */}
          </div>

          {/* Activity Log */}
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Nhật ký hoạt động
            </h2>
            <div className="space-y-3">
              {activityLog.map((log, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <CheckCircle2 className="w-4 h-4 text-aqua mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.time} · {log.trigger}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chatbot FAB */}
        <button className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 gradient-ocean rounded-full shadow-elevated flex items-center justify-center hover:shadow-glow transition-shadow">
          <Bot className="w-6 h-6 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
