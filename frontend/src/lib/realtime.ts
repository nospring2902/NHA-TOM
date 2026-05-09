import { io, type Socket } from "socket.io-client";
import { getApiOrigin } from "@/lib/http";

type RealtimeSocket = Socket;

export const createRealtimeSocket = (token?: string | null): RealtimeSocket | null => {
  if (!token) {
    return null;
  }

  return io(`${getApiOrigin()}/realtime`, {
    auth: {
      token: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    transports: ["websocket"],
  });
};

export type { RealtimeSocket };
