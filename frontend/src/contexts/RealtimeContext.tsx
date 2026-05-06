import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthSession } from "@/lib/auth";
import { createRealtimeSocket, type RealtimeSocket } from "@/lib/realtime";

type RealtimeContextValue = {
  socket: RealtimeSocket | null;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
});

export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const session = useMemo(() => getAuthSession(), []);
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const nextSocket = createRealtimeSocket(session.accessToken);
    if (!nextSocket) {
      return;
    }

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [session?.accessToken]);

  return (
    <RealtimeContext.Provider value={{ socket }}>{children}</RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  return useContext(RealtimeContext);
};
