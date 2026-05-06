import { http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type FriendItem = {
  id: string;
  fullName: string;
  email: string;
  isOnline: boolean;
};

export type FriendSuggestion = {
  id: string;
  fullName: string;
  email: string;
  isRequested: boolean;
};

export type FriendRequest = {
  id: string;
  requester: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
};

export type MessageItem = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
};

export type FriendRequestResult = {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requestId?: string;
};

export type SendMessageRequest = {
  content: string;
};

export const listFriends = async (): Promise<ApiEnvelope<FriendItem[]>> => {
  const response = await http.get<ApiEnvelope<FriendItem[]>>("/friends");
  return response.data;
};

export const listFriendSuggestions = async (
  limit = 6,
): Promise<ApiEnvelope<FriendSuggestion[]>> => {
  const response = await http.get<ApiEnvelope<FriendSuggestion[]>>("/friends/suggestions", {
    params: { limit },
  });
  return response.data;
};

export const listFriendRequests = async (): Promise<ApiEnvelope<FriendRequest[]>> => {
  const response = await http.get<ApiEnvelope<FriendRequest[]>>("/friends/requests");
  return response.data;
};

export const sendFriendRequest = async (
  friendId: string,
): Promise<ApiEnvelope<FriendRequestResult>> => {
  const response = await http.post<ApiEnvelope<FriendRequestResult>>("/friends/requests", {
    friendId,
  });
  return response.data;
};

export const acceptFriendRequest = async (
  requestId: string,
): Promise<ApiEnvelope<{ requestId: string; friend: FriendItem }>> => {
  const response = await http.post<ApiEnvelope<{ requestId: string; friend: FriendItem }>>(
    `/friends/requests/${requestId}/accept`,
  );
  return response.data;
};

export const rejectFriendRequest = async (
  requestId: string,
): Promise<ApiEnvelope<{ id: string; status: string }>> => {
  const response = await http.post<ApiEnvelope<{ id: string; status: string }>>(
    `/friends/requests/${requestId}/reject`,
  );
  return response.data;
};

export const listMessages = async (
  friendId: string,
  limit = 50,
): Promise<ApiEnvelope<MessageItem[]>> => {
  const response = await http.get<ApiEnvelope<MessageItem[]>>(`/friends/${friendId}/messages`, {
    params: {
      limit,
    },
  });
  return response.data;
};

export const sendMessage = async (
  friendId: string,
  payload: SendMessageRequest,
): Promise<ApiEnvelope<MessageItem>> => {
  const response = await http.post<ApiEnvelope<MessageItem>>(
    `/friends/${friendId}/messages`,
    payload,
  );
  return response.data;
};
