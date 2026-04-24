import axios from "axios";
import { getAccessToken } from "@/lib/auth";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_BACKEND_URL ??
  "http://localhost:3000/api/v1";

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((config) => {
  const headers = config.headers;
  const accessToken = getAccessToken();

  if (!headers) {
    config.headers = {};

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  }

  const hasSetApi = typeof (headers as { set?: unknown }).set === "function";
  if (hasSetApi) {
    const axiosHeaders = headers as {
      get: (name: string) => string | undefined;
      set: (name: string, value: string) => void;
    };
    if (accessToken && !axiosHeaders.get("authorization")) {
      axiosHeaders.set("authorization", `Bearer ${accessToken}`);
    }
  } else {
    const plainHeaders = headers as Record<string, string>;
    if (accessToken && !plainHeaders.authorization) {
      plainHeaders.authorization = `Bearer ${accessToken}`;
    }
  }

  return config;
});
