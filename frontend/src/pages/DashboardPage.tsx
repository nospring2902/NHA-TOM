import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Droplets, Thermometer, Wind, Gauge, Power, ArrowLeft, CloudRain, Sun, AlertTriangle, Download, Activity, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const chartData = [
  { time: "06:00", pH: 7.6, DO: 5.1, temp: 28.5 },
  { time: "08:00", pH: 7.7, DO: 5.3, temp: 29.0 },
  { time: "10:00", pH: 7.8, DO: 5.0, temp: 30.2 },
  { time: "12:00", pH: 8.0, DO: 4.8, temp: 31.5 },
  { time: "14:00", pH: 7.9, DO: 4.6, temp: 32.0 },
  { time: "16:00", pH: 7.8, DO: 4.9, temp: 31.0 },
  { time: "18:00", pH: 7.7, DO: 5.2, temp: 29.8 },
  { time: "20:00", pH: 7.6, DO: 5.4, temp: 28.5 },
];

const alerts = [
  { type: "warning", message: "Oxy có thể giảm vào ban đêm", time: "Dự đoán 6h tới" },
  { type: "info", message: "Nhiệt độ ổn định trong 24h tới", time: "Dự đoán 24h" },
];

const activityLog = [
  { time: "20:15", action: "Máy sục khí BẬT", trigger: "Oxy thấp (tự động)" },
  { time: "18:00", action: "Đèn ao BẬT", trigger: "Lịch hẹn giờ" },
  { time: "14:30", action: "Bơm nước TẮT", trigger: "Thủ công" },
];

const DashboardPage = () => {
  const { id } = useParams();
  const [aerator, setAerator] = useState(true);
  const [pump, setPump] = useState(false);
  const [light, setLight] = useState(true);
  const [activeChart, setActiveChart] = useState<"pH" | "DO" | "temp">("pH");

  const sensorCards = [
    { label: "Nhiệt độ", value: "29.5°C", icon: Thermometer, color: "text-coral", status: "Bình thường" },
    { label: "pH", value: "7.8", icon: Droplets, color: "text-primary", status: "Bình thường" },
    { label: "Oxy hòa tan", value: "5.2 mg/L", icon: Wind, color: "text-aqua", status: "Tốt" },
    { label: "Độ mặn", value: "22‰", icon: Gauge, color: "text-wave", status: "Bình thường" },
  ];

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
              <h1 className="text-base font-bold text-foreground">Ao Tôm A{id}</h1>
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
            <span className="text-xs font-medium text-aqua bg-aqua-light px-2.5 py-1 rounded-full">Tốt</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-primary">82<span className="text-lg text-muted-foreground">/100</span></div>
            <div className="flex-1">
              <Progress value={82} className="h-3 bg-secondary [&>div]:gradient-ocean" />
            </div>
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
                <Line type="monotone" dataKey={active.key} stroke={active.color} strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
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
