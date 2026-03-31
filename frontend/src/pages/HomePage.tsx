import { useState } from "react";
import { Heart, MessageCircle, Share2, Image, Send, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AppLayout from "@/components/AppLayout";

const mockPosts = [
  {
    id: 1,
    user: "Trần Minh Tuấn",
    avatar: "MT",
    time: "2 giờ trước",
    content: "Hôm nay ao tôm đạt pH 7.8, DO 5.2 mg/L – chỉ số rất ổn định! Chia sẻ kinh nghiệm: nên kiểm tra nước 2 lần/ngày vào sáng sớm và chiều tối.",
    likes: 24,
    comments: 8,
    liked: false,
  },
  {
    id: 2,
    user: "Nguyễn Thị Hoa",
    avatar: "NH",
    time: "5 giờ trước",
    content: "Vụ tôm này thu hoạch được 3 tấn/ao, nhờ hệ thống cảnh báo kịp thời khi oxy xuống thấp đêm qua. Cảm ơn AquaShrimp! 🦐",
    likes: 56,
    comments: 15,
    liked: true,
  },
  {
    id: 3,
    user: "Lê Văn Hùng",
    avatar: "LH",
    time: "1 ngày trước",
    content: "Ai có kinh nghiệm xử lý khi độ mặn tăng đột ngột không? Ao mình đang ở 28‰, bình thường chỉ 20-22‰. Mong mọi người tư vấn!",
    likes: 12,
    comments: 23,
    liked: false,
  },
];

const suggestedFriends = [
  { name: "Phạm Văn Đức", avatar: "PD", ponds: 3 },
  { name: "Hoàng Mai Lan", avatar: "HL", ponds: 5 },
  { name: "Võ Thanh Sơn", avatar: "VS", ponds: 2 },
];

const HomePage = () => {
  const [posts, setPosts] = useState(mockPosts);

  const toggleLike = (id: number) => {
    setPosts(posts.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  };

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 max-w-4xl mx-auto">
          {/* Feed */}
          <div className="space-y-5">
            {/* Create post */}
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <div className="flex gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="gradient-ocean text-primary-foreground text-sm">NV</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <input
                    placeholder="Chia sẻ kinh nghiệm nuôi tôm..."
                    className="w-full bg-muted rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
                      <Image className="w-4 h-4" /> Ảnh
                    </Button>
                    <Button size="sm" className="gradient-ocean text-primary-foreground border-0 gap-2">
                      <Send className="w-3.5 h-3.5" /> Đăng
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts */}
            {posts.map((post) => (
              <div key={post.id} className="bg-card rounded-xl border border-border shadow-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-medium">{post.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{post.user}</p>
                      <p className="text-xs text-muted-foreground">{post.time}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4">{post.content}</p>
                <div className="flex items-center gap-4 pt-3 border-t border-border">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? "text-coral" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} />
                    {post.likes}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block space-y-5">
            {/* Online */}
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Đang hoạt động</h3>
              <div className="space-y-3">
                {["Trần Minh Tuấn", "Nguyễn Thị Hoa"].map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">{name.split(" ").map(w => w[0]).join("").slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-aqua rounded-full border-2 border-card" />
                    </div>
                    <span className="text-sm text-foreground">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Friend suggestions */}
            <div className="bg-card rounded-xl border border-border shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Gợi ý kết bạn</h3>
              <div className="space-y-3">
                {suggestedFriends.map((f) => (
                  <div key={f.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-ocean-light text-primary text-xs font-medium">{f.avatar}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.ponds} ao tôm</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs h-7">Kết bạn</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default HomePage;
