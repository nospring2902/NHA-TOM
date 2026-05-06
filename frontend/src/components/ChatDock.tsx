import { Loader2, MoreHorizontal, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/ChatContext";
import { useFriends } from "@/contexts/FriendsContext";
import { getAuthSession } from "@/lib/auth";

const getInitials = (name: string): string => {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "NT";
  }

  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const formatRelativeTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Vừa xong";
  }

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) {
    return "Vừa xong";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const ChatDock = () => {
  const {
    openChatIds,
    chatTargets,
    messagesByUserId,
    loadingByUserId,
    sendingByUserId,
    draftByUserId,
    closeChat,
    sendChatMessage,
    setDraft,
  } = useChat();
  const { onlineUserIds } = useFriends();
  const currentUserId = getAuthSession()?.user.id ?? null;

  if (openChatIds.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-row-reverse gap-3">
      {openChatIds.map((userId) => {
        const target = chatTargets[userId];
        if (!target) {
          return null;
        }

        const messages = messagesByUserId[userId] ?? [];
        const isLoading = loadingByUserId[userId];
        const isSending = sendingByUserId[userId];
        const isOnline = onlineUserIds.has(userId);

        return (
          <div
            key={userId}
            className="w-72 bg-card border border-border rounded-xl shadow-elevated flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {getInitials(target.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-aqua rounded-full border-2 border-card" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{target.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => closeChat(userId)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 max-h-72 overflow-y-auto p-3 space-y-2 bg-muted/20">
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tải tin nhắn...
                </div>
              )}
              {!isLoading && messages.length === 0 && (
                <p className="text-xs text-muted-foreground">Chưa có tin nhắn.</p>
              )}
              {!isLoading &&
                messages.map((message) => {
                  const isOwn = message.senderId === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-foreground border border-border"
                        }`}
                      >
                        <p>{message.content}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            isOwn ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          {formatRelativeTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="border-t border-border p-2 flex items-center gap-2">
              <input
                value={draftByUserId[userId] ?? ""}
                onChange={(event) => setDraft(userId, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendChatMessage(userId, draftByUserId[userId] ?? "");
                  }
                }}
                placeholder="Nhập tin nhắn..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => void sendChatMessage(userId, draftByUserId[userId] ?? "")}
                disabled={isSending || !(draftByUserId[userId] ?? "").trim()}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatDock;
