import type { User } from "@/features/users/types";

import type { AuthStatus } from "./constants";

export type CurrentUser = User;

export interface AuthContextValue {
  user: CurrentUser | null;
  status: AuthStatus;
  /** First load, before any result is known. */
  isLoading: boolean;
  /** Background revalidation while a result already exists. */
  isFetching: boolean;
  isAuthenticated: boolean;
  /** Full-page navigation to the backend OIDC login (optionally remembering a return path). */
  login: (redirectTo?: string) => void;
  /** Full-page navigation to the backend logout. */
  logout: () => void;
  /** Re-run the /auth/me query. */
  refetch: () => void;
}
