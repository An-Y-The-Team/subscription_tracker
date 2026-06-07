/**
 * Typed access to public environment variables. `NEXT_PUBLIC_*` values are inlined
 * at build time, so this is a single source of truth for client-readable config.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
