"use client";

import { useQuery } from "@tanstack/react-query";

import { HTTP_STATUS } from "@/constants";
import type { CurrentUser } from "@/features/auth/types";
import { api, isApiError } from "@/shared/api";

import {
  AUTH_ME_PATH,
  AUTH_QUERY_KEY,
  AUTH_STALE_TIME_MS,
} from "../../constants";

/**
 * Fetches the current user from the BFF. A 401 is an expected "not logged in"
 * answer (the api client throws on it), so it is surfaced via `error` and never
 * retried. Other failures retry a couple of times.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => api.get<CurrentUser>(AUTH_ME_PATH),
    staleTime: AUTH_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (isApiError(error) && error.status === HTTP_STATUS.UNAUTHORIZED) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
