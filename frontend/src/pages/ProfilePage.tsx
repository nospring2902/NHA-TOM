import { useState } from "react";
import { Link } from "react-router-dom";
import { Grid3x3, Waves, Settings, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";

const userPosts = [
  { id: 1, preview: "Thu hoạch vụ tôm thành công 🦐" },
  { id: 2, preview: "Chia sẻ kinh nghiệm xử lý pH" },
  { id: 3, preview: "Ao mới lắp cảm biến IoT" },
  { id: 4, preview: "Kết quả sau 3 tháng sử dụng" },
  { id: 5, preview: "Tips nuôi tôm mùa mưa" },
  { id: 6, preview: "Đánh giá hệ thống cảnh báo" },
];

const userPonds = [
  { id: 1, name: "Ao Tôm A1", area: "2,000 m²", location: "Cà Mau" },
  { id: 2, name: "Ao Tôm A2", area: "1,500 m²", location: "Cà Mau" },
  { id: 3, name: "Ao Tôm B1", area: "3,000 m²", location: "Bạc Liêu" },
];

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState<"posts" | "ponds">("posts");

  return (
    <AppLayout>
      <div className="container py-6 max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="gradient-ocean text-primary-foreground text-2xl font-bold">NV</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-foreground">Nguyễn Văn A</h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> Cà Mau, Việt Nam
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">3</p>
                  <p className="text-xs text-muted-foreground">Ao tôm</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">128</p>
                  <p className="text-xs text-muted-foreground">Bạn bè</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">6</p>
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
            {userPosts.map((post) => (
              <div key={post.id} className="aspect-square bg-secondary rounded-lg flex items-center justify-center p-3 hover:bg-ocean-light transition-colors cursor-pointer">
                <p className="text-xs text-secondary-foreground text-center font-medium">{post.preview}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {userPonds.map((pond) => (
              <Link key={pond.id} to={`/dashboard/${pond.id}`}>
                <div className="bg-card rounded-xl border border-border shadow-card p-4 hover:shadow-elevated transition-all cursor-pointer group">
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
                    <span className="text-xs text-aqua font-medium">Xem chi tiết →</span>
                  </div>
                </div>
              </Link>
            ))}
            <Button variant="outline" className="w-full border-dashed text-muted-foreground">
              + Thêm ao tôm mới
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
