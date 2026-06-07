"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import { useAuth } from "../../auth-provider";
import { AuthStatus } from "../../constants";

/**
 * Client-side route guard. UX only — the backend is the real gate (it validates the
 * httponly session cookie on every request). Redirects to /login on a 401, shows an
 * error state on other failures (never a redirect loop), and a skeleton while loading.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, refetch } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === AuthStatus.UNAUTHENTICATED) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === AuthStatus.LOADING) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (status === AuthStatus.ERROR) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">
          We couldn&apos;t verify your session. Please try again.
        </p>
        <Button variant="outline" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  // UNAUTHENTICATED renders nothing while the redirect above runs (avoids a content flash).
  if (status !== AuthStatus.AUTHENTICATED) {
    return null;
  }

  return <>{children}</>;
}
