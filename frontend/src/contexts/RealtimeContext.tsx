import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthSession, subscribeAuthSession } from "@/lib/auth";
import { createRealtimeSocket, type RealtimeSocket } from "@/lib/realtime";

type RealtimeContextValue = {
  socket: RealtimeSocket | null;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
});

export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const [authVersion, setAuthVersion] = useState(0);
  const session = useMemo(() => getAuthSession(), [authVersion]);
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);

  useEffect(() => {
    return subscribeAuthSession(() => {
      setAuthVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!session?.accessToken) {
      setSocket(null);
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
