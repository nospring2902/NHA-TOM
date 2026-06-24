import { http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

export const listNotifications = async (
  limit = 20,
  cursor?: string,
  types?: string[],
): Promise<ApiEnvelope<NotificationItem[]>> => {
  const params: any = { limit, cursor };
  if (types && types.length > 0) {
    params.types = types.join(',');
  }
  const response = await http.get<ApiEnvelope<NotificationItem[]>>("/notifications", {
    params,
  });
  return response.data;
};

export const getUnreadCount = async (): Promise<ApiEnvelope<{ count: number }>> => {
  const response = await http.get<ApiEnvelope<{ count: number }>>(
    "/notifications/unread-count",
  );
  return response.data;
};

export const markNotificationRead = async (
  notificationId: string,
): Promise<ApiEnvelope<void>> => {
  const response = await http.post<ApiEnvelope<void>>(
    `/notifications/${notificationId}/read`,
  );
  return response.data;
};

export const markAllNotificationsRead = async (): Promise<ApiEnvelope<void>> => {
  const response = await http.post<ApiEnvelope<void>>("/notifications/read-all");
  return response.data;
};
