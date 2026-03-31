import { Link, useLocation } from "react-router-dom";
import { Home, User, Bell, MessageCircle, Droplets } from "lucide-react";

const navItems = [
  { to: "/home", icon: Home, label: "Trang chủ" },
  { to: "/notifications", icon: Bell, label: "Thông báo" },
  { to: "/chat", icon: MessageCircle, label: "Tin nhắn" },
  { to: "/profile", icon: User, label: "Cá nhân" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-b border-border h-14">
        <div className="container h-full flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <Droplets className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold text-foreground">AquaShrimp</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.to
                    ? "text-primary bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-14 pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                pathname === item.to ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
