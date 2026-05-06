import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  acceptFriendRequest,
  listFriendRequests,
  listFriendSuggestions,
  listFriends,
  rejectFriendRequest,
  sendFriendRequest,
  type FriendItem,
  type FriendRequest,
  type FriendSuggestion,
} from "@/lib/friends";
import { getApiErrorMessage } from "@/lib/device-binding";
import { useRealtime } from "@/contexts/RealtimeContext";

type FriendsContextValue = {
  friends: FriendItem[];
  suggestions: FriendSuggestion[];
  requests: FriendRequest[];
  onlineUserIds: Set<string>;
  isLoadingFriends: boolean;
  isLoadingSuggestions: boolean;
  isLoadingRequests: boolean;
  friendsError: string | null;
  suggestionsError: string | null;
  requestsError: string | null;
  refreshFriends: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  sendRequest: (friendId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
};

const FriendsContext = createContext<FriendsContextValue | undefined>(undefined);

export const FriendsProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket } = useRealtime();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  const refreshFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    setFriendsError(null);

    try {
      const response = await listFriends();
      setFriends(response.data);
    } catch (error) {
      setFriendsError(getApiErrorMessage(error, "Không tải được danh sách bạn bè"));
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  const refreshSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    setSuggestionsError(null);

    try {
      const response = await listFriendSuggestions();
      setSuggestions(response.data);
    } catch (error) {
      setSuggestionsError(getApiErrorMessage(error, "Không tải được gợi ý kết bạn"));
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const refreshRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);

    try {
      const response = await listFriendRequests();
      setRequests(response.data);
    } catch (error) {
      setRequestsError(getApiErrorMessage(error, "Không tải được lời mời kết bạn"));
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    void refreshFriends();
    void refreshSuggestions();
    void refreshRequests();
  }, [refreshFriends, refreshRequests, refreshSuggestions]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handlePresenceSync = (payload: { userIds?: string[] }) => {
      const ids = Array.isArray(payload?.userIds) ? payload.userIds : [];
      setOnlineUserIds(new Set(ids));
    };

    const handlePresenceUpdate = (payload: { userId?: string; isOnline?: boolean }) => {
      if (!payload?.userId) {
        return;
      }

      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (payload.isOnline) {
          next.add(payload.userId);
        } else {
          next.delete(payload.userId);
        }
        return next;
      });
    };

    const handleFriendRequest = (payload: FriendRequest) => {
      if (!payload?.id) {
        return;
      }

      setRequests((current) => {
        if (current.some((item) => item.id === payload.id)) {
          return current;
        }
        return [payload, ...current];
      });
    };

    const handleFriendAccepted = (payload: { friend?: FriendItem }) => {
      if (!payload?.friend) {
        return;
      }

      setFriends((current) => {
        if (current.some((item) => item.id === payload.friend?.id)) {
          return current;
        }

        return [{ ...payload.friend, isOnline: false }, ...current];
      });

      setRequests((current) => current.filter((request) => request.requester.id !== payload.friend?.id));
      setSuggestions((current) =>
        current.map((item) =>
          item.id === payload.friend?.id
            ? {
                ...item,
                isRequested: false,
              }
            : item,
        ),
      );
    };

    const handleFriendRejected = (payload: { userId?: string }) => {
      if (!payload?.userId) {
        return;
      }

      setSuggestions((current) =>
        current.map((item) =>
          item.id === payload.userId
            ? {
                ...item,
                isRequested: false,
              }
            : item,
        ),
      );
    };

    socket.on("presence:sync", handlePresenceSync);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("friend:request", handleFriendRequest);
    socket.on("friend:accepted", handleFriendAccepted);
    socket.on("friend:rejected", handleFriendRejected);

    return () => {
      socket.off("presence:sync", handlePresenceSync);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("friend:request", handleFriendRequest);
      socket.off("friend:accepted", handleFriendAccepted);
      socket.off("friend:rejected", handleFriendRejected);
    };
  }, [socket]);

  const sendRequest = useCallback(async (friendId: string) => {
    await sendFriendRequest(friendId);
    setSuggestions((current) =>
      current.map((item) =>
        item.id === friendId
          ? {
              ...item,
              isRequested: true,
            }
          : item,
      ),
    );
  }, []);

  const acceptRequest = useCallback(async (requestId: string) => {
    const response = await acceptFriendRequest(requestId);
    setRequests((current) => current.filter((item) => item.id !== requestId));
    setFriends((current) => {
      if (current.some((item) => item.id === response.data.friend.id)) {
        return current;
      }

      return [{ ...response.data.friend, isOnline: false }, ...current];
    });
    await refreshSuggestions();
  }, [refreshSuggestions]);

  const rejectRequest = useCallback(async (requestId: string) => {
    await rejectFriendRequest(requestId);
    setRequests((current) => current.filter((item) => item.id !== requestId));
  }, []);

  const value = useMemo(
    () => ({
      friends,
      suggestions,
      requests,
      onlineUserIds,
      isLoadingFriends,
      isLoadingSuggestions,
      isLoadingRequests,
      friendsError,
      suggestionsError,
      requestsError,
      refreshFriends,
      refreshSuggestions,
      refreshRequests,
      sendRequest,
      acceptRequest,
      rejectRequest,
    }),
    [
      friends,
      suggestions,
      requests,
      onlineUserIds,
      isLoadingFriends,
      isLoadingSuggestions,
      isLoadingRequests,
      friendsError,
      suggestionsError,
      requestsError,
      refreshFriends,
      refreshSuggestions,
      refreshRequests,
      sendRequest,
      acceptRequest,
      rejectRequest,
    ],
  );

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error("useFriends must be used within FriendsProvider");
  }
  return context;
};
