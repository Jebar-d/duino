"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../lib/api";

export type SessionUser = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  contact_number: string | null;
  address: string | null;
  extra_addresses?: Partial<{
    first_name: string; middle_name: string; last_name: string; suffix: string;
    address_line: string; city: string; province: string; postal_code: string; contact_number: string;
  }>[];
  role?: string;
  email_verified?: boolean;
  created_at?: string;
};

type SessionValue = {
  user: SessionUser | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<SessionUser | null>;
  setUser: (user: SessionUser | null) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

// One place that knows who is logged in, so the header, the admin-only
// redirect and the login page all agree and only ask the server once.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: SessionUser | null }>(
        "/auth/user/me.php",
      );
      setUser(data.user ?? null);
      return data.user ?? null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timer);
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      refresh,
      setUser,
    }),
    [user, loading, refresh],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }

  return value;
}
