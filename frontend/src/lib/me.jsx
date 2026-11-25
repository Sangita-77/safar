import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useApi } from "@/lib/api";

const MeCtx = createContext(null);

export function MeProvider({ children }) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/me")).data,
    enabled: !!isSignedIn,
  });
  return <MeCtx.Provider value={q}>{children}</MeCtx.Provider>;
}

export const useMe = () => useContext(MeCtx);
