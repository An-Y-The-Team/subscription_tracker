"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { API_URL } from "@/config/env";
import { HTTP_STATUS } from "@/constants";
import { isApiError } from "@/shared/api";

import {
  AUTH_QUERY_KEY,
  AuthStatus,
  DEFAULT_POST_LOGIN_REDIRECT,
  LOGIN_PATH,
  LOGOUT_PATH,
} from "./constants";
import { useCurrentUser } from "./hooks/use-current-user/use-current-user";
import type { AuthContextValue } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, error, isLoading, isFetching, refetch } = useCurrentUser();

  const isUnauthorized =
    isApiError(error) && error.status === HTTP_STATUS.UNAUTHORIZED;
  const user = data ?? null;

  // Derive a single resolved status the UI can switch on.
  let status: AuthStatus;
  if (isLoading) {
    status = AuthStatus.LOADING;
  } else if (user) {
    status = AuthStatus.AUTHENTICATED;
  } else if (isUnauthorized) {
    status = AuthStatus.UNAUTHENTICATED;
  } else {
    status = AuthStatus.ERROR;
  }

  // Begin OIDC login via a real top-level navigation to the BFF (not a client transition).
  const login = useCallback(
    (redirectTo: string = DEFAULT_POST_LOGIN_REDIRECT) => {
      const next = encodeURIComponent(redirectTo);
      window.location.assign(`${API_URL}${LOGIN_PATH}?next=${next}`);
    },
    []
  );

  // Clear cached identity immediately, then navigate to the BFF logout.
  const logout = useCallback(() => {
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    window.location.assign(`${API_URL}${LOGOUT_PATH}`);
  }, [queryClient]);

  const handleRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isLoading,
      isFetching,
      isAuthenticated: status === AuthStatus.AUTHENTICATED,
      login,
      logout,
      refetch: handleRefetch,
    }),
    [user, status, isLoading, isFetching, login, logout, handleRefetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
