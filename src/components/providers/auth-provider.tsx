"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api/client";
import type { LoginRequest, UserAccount } from "@/lib/types";

interface AuthContextValue {
  user: UserAccount | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<{
    requires2FA: boolean;
    tempToken?: string;
    user?: UserAccount;
  }>;
  verify2FA: (
    tempToken: string,
    code: string,
    method: "totp" | "recovery"
  ) => Promise<UserAccount>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserAccount | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state is derived from HttpOnly cookies via GET /auth/me.
 * Never persist session tokens in localStorage.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.auth.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await api.auth.login(payload);
    if (!result.requires2FA && result.user) {
      setUser(result.user);
    }
    return result;
  }, []);

  const verify2FA = useCallback(
    async (tempToken: string, code: string, method: "totp" | "recovery") => {
      const result = await api.auth.verify2FA({ tempToken, code, method });
      setUser(result.user);
      return result.user;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      verify2FA,
      logout,
      refreshUser,
      setUser,
    }),
    [user, isLoading, login, verify2FA, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
