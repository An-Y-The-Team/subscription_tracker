/** A user as returned by the backend (camelCase JSON from /auth/me). */
export interface User {
  id: string;
  email: string;
  name?: string | null;
}
