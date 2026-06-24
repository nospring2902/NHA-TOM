import { Link, useLocation } from "react-router-dom";
import { Home, User, MessageCircle, Droplets, Cpu, ClipboardList, Bell } from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import SearchBar from "@/components/SearchBar";
import ChatDock from "@/components/ChatDock";
import { useNotifications } from "@/contexts/NotificationContext";

const baseNavItems = [
  { to: "/home", icon: Home, label: "Trang chủ" },
  { to: "/tasks", icon: ClipboardList, label: "Nhiệm vụ" },
  { to: "/notifications", icon: Bell, label: "Thông báo" },
  { to: "/profile", icon: User, label: "Cá nhân" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const session = getAuthSession();
  const { unreadCount } = useNotifications();
  const navItems =
    session?.user.role === "ADMIN"
      ? [...baseNavItems, { to: "/admin/devices", icon: Cpu, label: "Admin Devices" }]
      : baseNavItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-b border-border h-14">
        <div className="container h-full flex items-center gap-6">
          <Link to="/home" className="flex items-center gap-2 shrink-0">
            <Droplets className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold text-foreground">Nhà tôm </span>
          </Link>
          <div className="flex-1 hidden md:block">
            <SearchBar />
          </div>
          <div className="hidden md:flex items-center gap-1 ml-auto">
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
                <div className="relative flex items-center justify-center">
                  <item.icon className="w-4 h-4" />
                  {item.to === "/notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-14 pb-16 md:pb-0">{children}</main>

      <ChatDock />

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
              <div className="relative flex items-center justify-center">
                <item.icon className="w-5 h-5" />
                {item.to === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
