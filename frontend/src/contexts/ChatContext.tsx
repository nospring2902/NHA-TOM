import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/device-binding";
import { listMessages, sendMessage, type MessageItem } from "@/lib/friends";
import { useRealtime } from "@/contexts/RealtimeContext";
import { useFriends } from "@/contexts/FriendsContext";
import { getAuthSession } from "@/lib/auth";

type ChatTarget = {
  id: string;
  fullName: string;
  email?: string;
};

type ChatContextValue = {
  openChatIds: string[];
  chatTargets: Record<string, ChatTarget>;
  messagesByUserId: Record<string, MessageItem[]>;
  loadingByUserId: Record<string, boolean>;
  sendingByUserId: Record<string, boolean>;
  draftByUserId: Record<string, string>;
  openChat: (target: ChatTarget) => void;
  closeChat: (userId: string) => void;
  loadMessages: (userId: string) => Promise<void>;
  sendChatMessage: (userId: string, content: string) => Promise<void>;
  setDraft: (userId: string, value: string) => void;
  errorMessage: string | null;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const session = getAuthSession();
  const currentUserId = session?.user.id ?? null;
  const { socket } = useRealtime();
  const { onlineUserIds } = useFriends();
  const [openChatIds, setOpenChatIds] = useState<string[]>([]);
  const [chatTargets, setChatTargets] = useState<Record<string, ChatTarget>>({});
  const [messagesByUserId, setMessagesByUserId] = useState<Record<string, MessageItem[]>>({});
  const [loadingByUserId, setLoadingByUserId] = useState<Record<string, boolean>>({});
  const [sendingByUserId, setSendingByUserId] = useState<Record<string, boolean>>({});
  const [draftByUserId, setDraftByUserId] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    };

    socket.on("chat:message", handleChatMessage);

    return () => {
      socket.off("chat:message", handleChatMessage);
    };
  }, [currentUserId, socket]);

  const openChat = useCallback((target: ChatTarget) => {
    setChatTargets((current) => ({
      ...current,
      [target.id]: target,
    }));

    setOpenChatIds((current) => {
      if (current.includes(target.id)) {
        return [...current.filter((id) => id !== target.id), target.id];
      }
      return [...current, target.id];
    });

    if (!messagesByUserId[target.id]) {
      void loadMessages(target.id);
    }
  }, [messagesByUserId]);

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
      const response = await listMessages(userId, 50);
      setMessagesByUserId((current) => ({
        ...current,
        [userId]: response.data,
      }));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Không tải được tin nhắn"));
    } finally {
      setLoadingByUserId((current) => ({
        ...current,
        [userId]: false,
      }));
    }
  }, [loadingByUserId]);

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
      loadingByUserId,
      sendingByUserId,
      draftByUserId,
      openChat,
      closeChat,
      loadMessages,
      sendChatMessage,
      setDraft,
      errorMessage,
    }),
    [
      openChatIds,
      chatTargets,
      messagesByUserId,
      loadingByUserId,
      sendingByUserId,
      draftByUserId,
      openChat,
      closeChat,
      loadMessages,
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
