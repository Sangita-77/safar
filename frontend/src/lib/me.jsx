import { createContext, useContext, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useApi } from "@/lib/api";

const MeCtx = createContext(null);

export function MeProvider({ children }) {
  const api = useApi();
  const { isSignedIn, userId } = useAuth();
  const qc = useQueryClient();
  const prev = useRef(userId);
  useEffect(() => {
    if (prev.current !== userId) qc.clear();
    prev.current = userId;
  }, [userId, qc]);
  const q = useQuery({
    queryKey: ["me", userId],
    queryFn: async () => (await api.get("/me")).data,
    enabled: !!isSignedIn,
  });
  return <MeCtx.Provider value={q}>{children}</MeCtx.Provider>;
}

export const useMe = () => useContext(MeCtx);
