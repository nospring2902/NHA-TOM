import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Droplets, BarChart3, Users, Shield, Waves, Thermometer, Activity, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  { icon: Droplets, title: "Giám sát thời gian thực", desc: "Theo dõi pH, DO, nhiệt độ, độ mặn liên tục 24/7" },
  { icon: BarChart3, title: "Dự đoán thông minh", desc: "AI dự đoán biến động chất lượng nước trong 6-24h tới" },
  { icon: Users, title: "Cộng đồng nuôi tôm", desc: "Kết nối, chia sẻ kinh nghiệm với hàng nghìn nông dân" },
  { icon: Shield, title: "Cảnh báo tức thì", desc: "Nhận thông báo ngay khi phát hiện bất thường" },
  { icon: Waves, title: "Quản lý ao nuôi", desc: "Quản lý nhiều ao, điều khiển thiết bị từ xa" },
  { icon: Activity, title: "Phân tích dữ liệu", desc: "Biểu đồ trực quan, xuất báo cáo CSV dễ dàng" },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Droplets className="w-7 h-7 text-primary" />
            <span className="text-xl font-bold text-foreground">Nhà tôm </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Đăng nhập</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="gradient-ocean text-primary-foreground border-0">Đăng ký</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Ao nuôi tôm" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/50 to-background" />
        </div>
        <div className="relative container py-32 md:py-44">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="text-4xl md:text-6xl font-extrabold text-primary-foreground leading-tight mb-6">
              Nền tảng giám sát
              <br />
              <span className="text-aqua-glow">ao tôm thông minh</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 leading-relaxed">
              Kết hợp IoT, AI và cộng đồng – giúp bạn nuôi tôm hiệu quả hơn, giảm rủi ro và tăng năng suất.
            </p>
            <div className="flex gap-4">
              <Link to="/register">
                <Button size="lg" className="gradient-ocean text-primary-foreground border-0 text-base px-8 shadow-glow">
                  Bắt đầu miễn phí
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 text-base px-8">
                Tìm hiểu thêm
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-card border-b border-border">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              ["5,000+", "Ao tôm được giám sát"],
              ["2,500+", "Nông dân sử dụng"],
              ["99.9%", "Thời gian hoạt động"],
              ["30%", "Giảm tỷ lệ rủi ro"],
            ].map(([num, label]) => (
              <motion.div key={label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{num}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Tính năng nổi bật</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Tất cả những gì bạn cần để quản lý ao tôm hiệu quả
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg gradient-ocean flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-deep">
        <div className="container text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Sẵn sàng nâng cấp ao tôm của bạn?
            </h2>
            <p className="text-primary-foreground/70 text-lg mb-8 max-w-lg mx-auto">
              Đăng ký miễn phí và bắt đầu giám sát ao tôm ngay hôm nay
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-aqua text-accent-foreground hover:bg-aqua-glow text-base px-10 shadow-glow">
                Đăng ký ngay
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-card border-t border-border">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Nhà tôm </span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Nhà tôm . Nền tảng giám sát ao tôm thông minh.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
