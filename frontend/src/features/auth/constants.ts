/** React Query key for the current-user query. */
export const AUTH_QUERY_KEY = ["auth", "me"] as const;

/** Backend BFF endpoints (relative to API_URL). */
export const AUTH_ME_PATH = "/auth/me";
export const LOGIN_PATH = "/auth/login";
export const LOGOUT_PATH = "/auth/logout";

/** Where the backend sends the browser back to after a successful login. */
export const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";

/** Treat the session as fresh for 5 minutes before background-revalidating. */
export const AUTH_STALE_TIME_MS = 5 * 60 * 1000;

/** Name of the BFF session cookie — must match the backend's SESSION_COOKIE_NAME. */
export const SESSION_COOKIE_NAME = "hm_session";

/** Resolved authentication state, derived from the /auth/me query. */
export enum AuthStatus {
  LOADING = "loading",
  AUTHENTICATED = "authenticated",
  UNAUTHENTICATED = "unauthenticated",
  ERROR = "error",
}
