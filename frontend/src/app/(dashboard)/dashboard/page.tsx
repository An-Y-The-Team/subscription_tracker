"use client";

import { SignOutButton } from "@/features/auth/components/sign-out-button/sign-out-button";
import { useAuth } from "@/features/auth/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {user?.name ?? user?.email}
        </p>
      </div>
      <SignOutButton />
    </div>
  );
}
