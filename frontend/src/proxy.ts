import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/features/auth/constants";

/**
 * Next.js 16 Proxy (the renamed `middleware`). Fast first gate for protected routes:
 * if the BFF session cookie is absent, redirect to /login before rendering.
 *
 * This is a presence check only — it cannot validate the cookie (that's the backend's
 * job; the AuthGuard + /auth/me handle expired/invalid sessions). It only works because
 * the cookie is scoped so the frontend origin receives it (shared `localhost` in dev,
 * a shared parent domain in prod). If that ever stops being true, delete this file and
 * rely solely on the client AuthGuard.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
