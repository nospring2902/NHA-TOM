import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notifications";
import { useRealtime } from "@/contexts/RealtimeContext";
import { getAccessToken, subscribeAuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refreshNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket } = useRealtime();
  const [authVersion, setAuthVersion] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshNotifications = useCallback(async () => {
    if (!getAccessToken()) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await listNotifications(30);
      setNotifications(response.data);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!getAccessToken()) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadCount();
      setUnreadCount(response.data.count);
    } catch {
      // silent fail
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((current) =>
        current.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // silent fail
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    return subscribeAuthSession(() => {
      setAuthVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    void refreshNotifications();
    void refreshUnreadCount();
  }, [authVersion, refreshNotifications, refreshUnreadCount]);

  // Listen for realtime notification events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (payload: NotificationItem) => {
      if (!payload?.id) return;

      setNotifications((current) => {
        if (current.some((n) => n.id === payload.id)) return current;
        return [payload, ...current];
      });
      setUnreadCount((current) => current + 1);

      toast({
        title: payload.title,
        description: payload.body,
        variant: payload.type?.startsWith("alert") ? "destructive" : "default",
      });
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      refreshNotifications,
      refreshUnreadCount,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, isLoading, refreshNotifications, refreshUnreadCount, markRead, markAllRead],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
