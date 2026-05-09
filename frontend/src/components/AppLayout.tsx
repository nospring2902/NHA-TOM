import { Link, useLocation } from "react-router-dom";
import { Home, User, Bell, MessageCircle, Droplets, Cpu } from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import SearchBar from "@/components/SearchBar";
import ChatDock from "@/components/ChatDock";
import { useFriends } from "@/contexts/FriendsContext";
import { useChat } from "@/contexts/ChatContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const baseNavItems = [
  { to: "/home", icon: Home, label: "Trang chủ" },
  { to: "/notifications", icon: Bell, label: "Thông báo" },
  { to: "/chat", icon: MessageCircle, label: "Tin nhắn" },
  { to: "/profile", icon: User, label: "Cá nhân" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const session = getAuthSession();
  const { requests, acceptRequest, rejectRequest } = useFriends();
  const { unreadTotal, unreadThreads, openChat } = useChat();
  const navItems =
    session?.user.role === "ADMIN"
      ? [...baseNavItems, { to: "/admin/devices", icon: Cpu, label: "Admin Devices" }]
      : baseNavItems;

  const notificationCount = requests.length + unreadTotal;

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
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground">
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-coral text-[10px] text-white flex items-center justify-center">
                      {notificationCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {requests.length === 0 && unreadTotal === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Không có thông báo mới.
                  </div>
                )}

                {unreadTotal > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Tin nhắn mới ({unreadTotal})
                    </div>
                    {unreadThreads.slice(0, 3).map((thread) => (
                      <DropdownMenuItem
                        key={thread.userId}
                        className="flex flex-col items-start gap-0.5"
                        onSelect={() =>
                          openChat({
                            id: thread.userId,
                            fullName: thread.fullName,
                          })
                        }
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {thread.fullName}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {thread.count}
                          </span>
                        </div>
                        {thread.lastMessage && (
                          <span className="text-[11px] text-muted-foreground truncate w-full">
                            {thread.lastMessage}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                {requests.map((request) => (
                  <div key={request.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {request.requester.fullName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Đã gửi lời mời kết bạn</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => void acceptRequest(request.id)}
                        >
                          Đồng ý
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => void rejectRequest(request.id)}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
