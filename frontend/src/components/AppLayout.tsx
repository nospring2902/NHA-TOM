import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, User, Cpu, ClipboardList, Bell, LogOut } from "lucide-react";
import { clearAuthSession, getAuthSession } from "@/lib/auth";
import SearchBar from "@/components/SearchBar";
import ChatDock from "@/components/ChatDock";
import { useNotifications } from "@/contexts/NotificationContext";
import { AppBrand } from "@/components/AppBrand";
import { Button } from "@/components/ui/button";

const baseNavItems = [
  { to: "/home", icon: Home, label: "Trang chủ" },
  { to: "/tasks", icon: ClipboardList, label: "Nhiệm vụ" },
  { to: "/notifications", icon: Bell, label: "Thông báo" },
  { to: "/profile", icon: User, label: "Cá nhân" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const session = getAuthSession();
  const { unreadCount } = useNotifications();
  const navItems =
    session?.user.role === "ADMIN"
      ? [...baseNavItems, { to: "/admin/devices", icon: Cpu, label: "Admin Devices" }]
      : baseNavItems;

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-b border-border h-14">
        <div className="container h-full flex items-center gap-6">
          <AppBrand to="/home" size="md" className="shrink-0" />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive gap-2 ml-1"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="md:hidden ml-auto text-muted-foreground hover:text-destructive"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </Button>
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
