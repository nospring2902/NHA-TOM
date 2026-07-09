import { useCallback, useEffect, useState, useRef } from "react";
import { Bell, Loader2, CheckCircle2, UserPlus, MessageSquare, ClipboardList, Clock, Briefcase, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { listNotifications, type NotificationItem, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications";
import { useNotifications } from "@/contexts/NotificationContext";
import { useFriends } from "@/contexts/FriendsContext";
import { useChat } from "@/contexts/ChatContext";
import { getAuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { acceptInvite as acceptFarmInvite, rejectInvite as rejectFarmInvite, listMyInvites, type FarmInvite } from "@/lib/collaboration";

type TabValue = "ALL" | "ALERT" | "FRIEND" | "TASK" | "CHAT" | "FARM";

const TABS: { id: TabValue; label: string; types?: string[] }[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "ALERT", label: "Cảnh báo ao", types: ["alert"] },
  { id: "FRIEND", label: "Lời mời kết bạn", types: ["friend_request", "friend_accepted"] },
  { id: "TASK", label: "Nhiệm vụ", types: ["task_assigned", "task_updated"] },
  { id: "CHAT", label: "Tin nhắn", types: ["chat_message"] },
  { id: "FARM", label: "Cộng tác", types: ["farm_invite", "farm_invite_accepted", "farm_member_removed"] },
];

const formatDate = (date: string) => {
  return new Date(date).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function NotificationsPage() {
  const session = getAuthSession();
  const { markRead: markContextRead, markAllRead: markContextAllRead, refreshUnreadCount } = useNotifications();
  const { acceptRequest, rejectRequest, requests, friends } = useFriends();
  const { openChat } = useChat();

  const [activeTab, setActiveTab] = useState<TabValue>("ALL");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingFarmInvites, setPendingFarmInvites] = useState<FarmInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | undefined>(undefined);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchFarmInvites = useCallback(async () => {
    try {
      const res = await listMyInvites();
      setPendingFarmInvites(res.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true);
      cursorRef.current = undefined;
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const tabConfig = TABS.find((t) => t.id === activeTab);
      const types = tabConfig?.types;
      const response = await listNotifications(20, cursorRef.current, types);
      
      const newItems = response.data;
      if (newItems.length < 20) {
        setHasMore(false);
      }
      
      if (newItems.length > 0) {
        cursorRef.current = newItems[newItems.length - 1].id;
      }

      setNotifications((prev) => (reset ? newItems : [...prev, ...newItems]));
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải thông báo", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchNotifications(true);
    void fetchFarmInvites();
  }, [fetchNotifications, fetchFarmInvites]);

  const handleMarkAsRead = async (id: string, isAlreadyRead: boolean) => {
    if (isAlreadyRead) return;
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      void markContextRead(id);
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      void markContextAllRead();
      toast({ title: "Thành công", description: "Đã đánh dấu tất cả là đã đọc" });
    } catch {
      toast({ title: "Lỗi", description: "Không thể đánh dấu đã đọc", variant: "destructive" });
    }
  };

  const handleAcceptFriend = async (requestId: string, notificationId: string) => {
    setProcessingId(requestId);
    try {
      await acceptRequest(requestId);
      await handleMarkAsRead(notificationId, false);
      toast({ title: "Thành công", description: "Đã chấp nhận lời mời kết bạn" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message || "Không thể chấp nhận", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectFriend = async (requestId: string, notificationId: string) => {
    setProcessingId(requestId);
    try {
      await rejectRequest(requestId);
      await handleMarkAsRead(notificationId, false);
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message || "Không thể từ chối", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptFarm = async (inviteId: string, notificationId: string) => {
    setProcessingId(inviteId);
    try {
      await acceptFarmInvite(inviteId);
      await handleMarkAsRead(notificationId, false);
      setPendingFarmInvites(prev => prev.filter(i => i.id !== inviteId));
      toast({ title: "Thành công", description: "Đã tham gia nhóm cộng tác" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message || "Không thể chấp nhận", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectFarm = async (inviteId: string, notificationId: string) => {
    setProcessingId(inviteId);
    try {
      await rejectFarmInvite(inviteId);
      await handleMarkAsRead(notificationId, false);
      setPendingFarmInvites(prev => prev.filter(i => i.id !== inviteId));
      toast({ title: "Thành công", description: "Đã từ chối nhóm cộng tác" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message || "Không thể từ chối", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const getIcon = (type: string) => {
    if (type.startsWith("alert")) return <AlertTriangle className="h-5 w-5 text-red-500" />;
    if (type.startsWith("friend")) return <UserPlus className="h-5 w-5 text-blue-500" />;
    if (type.startsWith("chat")) return <MessageSquare className="h-5 w-5 text-green-500" />;
    if (type.startsWith("task")) return <ClipboardList className="h-5 w-5 text-purple-500" />;
    if (type.startsWith("farm")) return <Briefcase className="h-5 w-5 text-orange-500" />;
    return <Bell className="h-5 w-5 text-gray-500" />;
  };

  if (!session) return null;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Thông báo</h1>
              <p className="text-sm text-muted-foreground">Cập nhật các hoạt động mới nhất</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Đánh dấu tất cả đã đọc
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Không có thông báo nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isFriendReq = notification.type === "friend_request";
              const requestId = notification.metadata?.requestId as string;
              // Check if request is still pending based on FriendsContext
              const isPendingReq = isFriendReq && requests.some(r => r.id === requestId);

              const isFarmInvite = notification.type === "farm_invite";
              const farmInviteId = notification.metadata?.inviteId as string;
              const isPendingFarmReq = isFarmInvite && pendingFarmInvites.some(r => r.id === farmInviteId);

              return (
                <div
                  key={notification.id}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer hover:bg-muted/50 ${
                    notification.isRead ? "bg-card border-transparent" : "bg-primary/5 border-primary/20"
                  }`}
                  onClick={() => {
                    handleMarkAsRead(notification.id, notification.isRead);
                    if (notification.type === "chat_message" && notification.metadata?.senderId) {
                      const friendId = notification.metadata.senderId as string;
                      const friend = friends.find(f => f.id === friendId);
                      openChat({
                        id: friendId,
                        fullName: friend?.fullName || "Người dùng",
                      });
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-background rounded-full shadow-sm">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-sm font-semibold ${notification.isRead ? "text-foreground" : "text-primary"}`}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 text-foreground/80">{notification.body}</p>

                      {isFriendReq && isPendingReq && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            disabled={processingId === requestId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptFriend(requestId, notification.id);
                            }}
                          >
                            {processingId === requestId && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            Chấp nhận
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === requestId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectFriend(requestId, notification.id);
                            }}
                          >
                            Từ chối
                          </Button>
                        </div>
                      )}
                      {isFriendReq && !isPendingReq && (
                         <div className="mt-2 text-xs text-muted-foreground italic">
                           Lời mời này đã được xử lý.
                         </div>
                      )}

                      {/* Farm Invite handling */}
                      {isFarmInvite && isPendingFarmReq && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            disabled={processingId === farmInviteId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptFarm(farmInviteId, notification.id);
                            }}
                          >
                            {processingId === farmInviteId && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            Đồng ý
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === farmInviteId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectFarm(farmInviteId, notification.id);
                            }}
                          >
                            Từ chối
                          </Button>
                        </div>
                      )}
                      {isFarmInvite && !isPendingFarmReq && (
                         <div className="mt-2 text-xs text-muted-foreground italic">
                           Lời mời cộng tác này đã được xử lý.
                         </div>
                      )}

                      {notification.type.startsWith("task_") && notification.metadata?.pondId && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id, notification.isRead);
                              window.location.href = `/dashboard/${notification.metadata!.pondId as string}`;
                            }}
                          >
                            Xem nhiệm vụ
                          </Button>
                        </div>
                      )}
                      {notification.type === "chat_message" && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id, notification.isRead);
                              if (notification.metadata?.senderId) {
                                const friendId = notification.metadata.senderId as string;
                                const friend = friends.find(f => f.id === friendId);
                                openChat({
                                  id: friendId,
                                  fullName: friend?.fullName || "Người dùng",
                                });
                              }
                            }}
                          >
                            Mở đoạn chat
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => fetchNotifications(false)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Tải thêm
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
