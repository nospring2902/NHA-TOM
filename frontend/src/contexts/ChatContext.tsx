import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/device-binding";
import { listMessages, sendMessage, type MessageItem } from "@/lib/friends";
import { useRealtime } from "@/contexts/RealtimeContext";
import { useFriends } from "@/contexts/FriendsContext";
import { getAuthSession, subscribeAuthSession } from "@/lib/auth";
import { http } from "@/lib/http";

type ChatTarget = {
  id: string;
  fullName: string;
  email?: string;
};

type UnreadMeta = {
  lastMessage: string;
  lastAt: string;
};

type UnreadThread = {
  userId: string;
  fullName: string;
  count: number;
  lastMessage: string;
  lastAt: string;
};

type ChatContextValue = {
  openChatIds: string[];
  chatTargets: Record<string, ChatTarget>;
  messagesByUserId: Record<string, MessageItem[]>;
  unreadByUserId: Record<string, number>;
  unreadThreads: UnreadThread[];
  unreadTotal: number;
  loadingByUserId: Record<string, boolean>;
  loadingMoreByUserId: Record<string, boolean>;
  hasMoreByUserId: Record<string, boolean>;
  sendingByUserId: Record<string, boolean>;
  draftByUserId: Record<string, string>;
  openChat: (target: ChatTarget) => void;
  closeChat: (userId: string) => void;
  loadMessages: (userId: string) => Promise<void>;
  loadMoreMessages: (userId: string) => Promise<void>;
  sendChatMessage: (userId: string, content: string) => Promise<void>;
  setDraft: (userId: string, value: string) => void;
  errorMessage: string | null;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const pageSize = 50;
  const [authVersion, setAuthVersion] = useState(0);
  const session = useMemo(() => getAuthSession(), [authVersion]);
  const currentUserId = session?.user.id ?? null;
  const { socket } = useRealtime();
  const { friends } = useFriends();
  const [openChatIds, setOpenChatIds] = useState<string[]>([]);
  const [chatTargets, setChatTargets] = useState<Record<string, ChatTarget>>({});
  const [messagesByUserId, setMessagesByUserId] = useState<Record<string, MessageItem[]>>({});
  const [unreadByUserId, setUnreadByUserId] = useState<Record<string, number>>({});
  const [unreadMetaByUserId, setUnreadMetaByUserId] = useState<Record<string, UnreadMeta>>({});
  const [loadingByUserId, setLoadingByUserId] = useState<Record<string, boolean>>({});
  const [loadingMoreByUserId, setLoadingMoreByUserId] = useState<Record<string, boolean>>({});
  const [hasMoreByUserId, setHasMoreByUserId] = useState<Record<string, boolean>>({});
  const [cursorByUserId, setCursorByUserId] = useState<Record<string, string | null>>({});
  const [sendingByUserId, setSendingByUserId] = useState<Record<string, boolean>>({});
  const [draftByUserId, setDraftByUserId] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadingTargetIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return subscribeAuthSession(() => {
      setAuthVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (currentUserId) {
      return;
    }

    setOpenChatIds([]);
    setChatTargets({});
    setMessagesByUserId({});
    setUnreadByUserId({});
    setUnreadMetaByUserId({});
    setLoadingByUserId({});
    setLoadingMoreByUserId({});
    setHasMoreByUserId({});
    setCursorByUserId({});
    setSendingByUserId({});
    setDraftByUserId({});
    setErrorMessage(null);
  }, [currentUserId]);

  const ensureChatTarget = useCallback(
    async (userId: string) => {
      if (!userId || chatTargets[userId]) {
        return;
      }

      const friend = friends.find((item) => item.id === userId);
      if (friend) {
        setChatTargets((current) => {
          if (current[userId]) {
            return current;
          }

          return {
            ...current,
            [userId]: {
              id: friend.id,
              fullName: friend.fullName,
              email: friend.email,
            },
          };
        });
        return;
      }

      if (loadingTargetIdsRef.current.has(userId)) {
        return;
      }
      loadingTargetIdsRef.current.add(userId);

      try {
        const response = await http.get<{
          success: boolean;
          message: string;
          data: { id: string; fullName: string; email: string };
        }>(`/users/${userId}`);

        const payload = response.data?.data;
        if (!payload?.id) {
          return;
        }

        setChatTargets((current) => {
          if (current[userId]) {
            return current;
          }

          return {
            ...current,
            [userId]: {
              id: payload.id,
              fullName: payload.fullName,
              email: payload.email,
            },
          };
        });
      } catch {
        // Ignore resolve errors; fallback name will be used.
      } finally {
        loadingTargetIdsRef.current.delete(userId);
      }
    },
    [chatTargets, friends],
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleChatMessage = (message: MessageItem) => {
      const friendId =
        message.senderId === currentUserId ? message.recipientId : message.senderId;
      if (!friendId) {
        return;
      }

      setMessagesByUserId((current) => ({
        ...current,
        [friendId]: [...(current[friendId] ?? []), message],
      }));

      const isIncoming = message.senderId !== currentUserId;
      const isChatOpen = openChatIds.includes(friendId);

      if (isIncoming) {
        void ensureChatTarget(friendId);
        setUnreadMetaByUserId((current) => ({
          ...current,
          [friendId]: {
            lastMessage: message.content,
            lastAt: message.createdAt,
          },
        }));
      }

      if (isIncoming && !isChatOpen) {
        setUnreadByUserId((current) => ({
          ...current,
          [friendId]: (current[friendId] ?? 0) + 1,
        }));
      }
    };

    socket.on("chat:message", handleChatMessage);

    return () => {
      socket.off("chat:message", handleChatMessage);
    };
  }, [currentUserId, ensureChatTarget, openChatIds, socket]);

  const unreadTotal = useMemo(() => {
    return Object.values(unreadByUserId).reduce((sum, value) => sum + value, 0);
  }, [unreadByUserId]);

  const unreadThreads = useMemo(() => {
    const threads = Object.entries(unreadByUserId)
      .filter(([, count]) => count > 0)
      .map(([userId, count]) => {
        const meta = unreadMetaByUserId[userId];
        const friend = friends.find((item) => item.id === userId);
        const target = chatTargets[userId];

        return {
          userId,
          fullName: target?.fullName ?? friend?.fullName ?? "Người dùng",
          count,
          lastMessage: meta?.lastMessage ?? "",
          lastAt: meta?.lastAt ?? "",
        } satisfies UnreadThread;
      });

    threads.sort((a, b) => {
      const aValue = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bValue = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return bValue - aValue;
    });

    return threads;
  }, [chatTargets, friends, unreadByUserId, unreadMetaByUserId]);

  const closeChat = useCallback((userId: string) => {
    setOpenChatIds((current) => current.filter((id) => id !== userId));
  }, []);

  const loadMessages = useCallback(async (userId: string) => {
    if (loadingByUserId[userId]) {
      return;
    }

    setLoadingByUserId((current) => ({
      ...current,
      [userId]: true,
    }));

    try {
      const response = await listMessages(userId, { limit: pageSize });
      const messages = response.data;
      setMessagesByUserId((current) => ({
        ...current,
        [userId]: messages,
      }));

      setCursorByUserId((current) => ({
        ...current,
        [userId]: messages.length > 0 ? messages[0].id : null,
      }));

      setHasMoreByUserId((current) => ({
        ...current,
        [userId]: messages.length === pageSize,
      }));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Không tải được tin nhắn"));
    } finally {
      setLoadingByUserId((current) => ({
        ...current,
        [userId]: false,
      }));
    }
  }, [loadingByUserId, pageSize]);

  const loadMoreMessages = useCallback(
    async (userId: string) => {
      if (loadingMoreByUserId[userId]) {
        return;
      }

      if (!hasMoreByUserId[userId]) {
        return;
      }

      const cursor = cursorByUserId[userId];
      if (!cursor) {
        return;
      }

      setLoadingMoreByUserId((current) => ({
        ...current,
        [userId]: true,
      }));

      try {
        const response = await listMessages(userId, { limit: pageSize, cursor });
        const olderMessages = response.data;

        if (olderMessages.length === 0) {
          setHasMoreByUserId((current) => ({
            ...current,
            [userId]: false,
          }));
          return;
        }

        setMessagesByUserId((current) => ({
          ...current,
          [userId]: [...olderMessages, ...(current[userId] ?? [])],
        }));

        setCursorByUserId((current) => ({
          ...current,
          [userId]: olderMessages[0].id,
        }));

        setHasMoreByUserId((current) => ({
          ...current,
          [userId]: olderMessages.length === pageSize,
        }));
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, "Không tải được tin nhắn cũ hơn"));
      } finally {
        setLoadingMoreByUserId((current) => ({
          ...current,
          [userId]: false,
        }));
      }
    },
    [cursorByUserId, hasMoreByUserId, loadingMoreByUserId, pageSize],
  );

  const openChat = useCallback((target: ChatTarget) => {
    setChatTargets((current) => ({
      ...current,
      [target.id]: target,
    }));

    setUnreadByUserId((current) => {
      if (!current[target.id]) {
        return current;
      }

      return {
        ...current,
        [target.id]: 0,
      };
    });

    setOpenChatIds((current) => {
      if (current.includes(target.id)) {
        return [...current.filter((id) => id !== target.id), target.id];
      }
      return [...current, target.id];
    });

    if (!messagesByUserId[target.id]) {
      void loadMessages(target.id);
    }
  }, [loadMessages, messagesByUserId]);

  const sendChatMessage = useCallback(async (userId: string, content: string) => {
    const normalized = content.trim();
    if (!normalized || sendingByUserId[userId]) {
      return;
    }

    setSendingByUserId((current) => ({
      ...current,
      [userId]: true,
    }));

    try {
      if (socket?.connected) {
        socket.emit("chat:send", {
          toUserId: userId,
          content: normalized,
        });
      } else {
        const response = await sendMessage(userId, { content: normalized });
        setMessagesByUserId((current) => ({
          ...current,
          [userId]: [...(current[userId] ?? []), response.data],
        }));
      }

      setDraftByUserId((current) => ({
        ...current,
        [userId]: "",
      }));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Không thể gửi tin nhắn"));
    } finally {
      setSendingByUserId((current) => ({
        ...current,
        [userId]: false,
      }));
    }
  }, [sendingByUserId, socket]);

  const setDraft = useCallback((userId: string, value: string) => {
    setDraftByUserId((current) => ({
      ...current,
      [userId]: value,
    }));
  }, []);

  const value = useMemo(
    () => ({
      openChatIds,
      chatTargets,
      messagesByUserId,
      unreadByUserId,
      unreadThreads,
      unreadTotal,
      loadingByUserId,
      loadingMoreByUserId,
      hasMoreByUserId,
      sendingByUserId,
      draftByUserId,
      openChat,
      closeChat,
      loadMessages,
      loadMoreMessages,
      sendChatMessage,
      setDraft,
      errorMessage,
    }),
    [
      openChatIds,
      chatTargets,
      messagesByUserId,
      unreadByUserId,
      unreadThreads,
      unreadTotal,
      loadingByUserId,
      loadingMoreByUserId,
      hasMoreByUserId,
      sendingByUserId,
      draftByUserId,
      openChat,
      closeChat,
      loadMessages,
      loadMoreMessages,
      sendChatMessage,
      setDraft,
      errorMessage,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};
