import { getApiOrigin, http } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type MeProfile = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  createdAt?: string;
  updatedAt?: string;
};

export const getMe = async (): Promise<ApiEnvelope<MeProfile>> => {
  const response = await http.get<ApiEnvelope<MeProfile>>("/users/me");
  return response.data;
};

export const updateDisplayName = async (
  fullName: string,
): Promise<ApiEnvelope<MeProfile>> => {
  const response = await http.patch<ApiEnvelope<MeProfile>>("/users/me", {
    fullName,
  });
  return response.data;
};

export const uploadAvatar = async (
  file: File,
): Promise<ApiEnvelope<{ id: string; avatarUrl: string }>> => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await http.post<ApiEnvelope<{ id: string; avatarUrl: string }>>(
    "/users/me/avatar",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
};

export const requestPasswordChange = async (payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<ApiEnvelope<{ email: string }>> => {
  const response = await http.post<ApiEnvelope<{ email: string }>>(
    "/users/me/change-password/request",
    payload,
  );
  return response.data;
};

export const confirmPasswordChange = async (
  code: string,
): Promise<ApiEnvelope<null>> => {
  const response = await http.post<ApiEnvelope<null>>(
    "/users/me/change-password/confirm",
    { code },
  );
  return response.data;
};

export const resolveAvatarUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const origin = getApiOrigin();
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
};
