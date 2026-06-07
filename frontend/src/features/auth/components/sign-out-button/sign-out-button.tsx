"use client";

import { Button } from "@/components/ui/button";

import { useAuth } from "../../auth-provider";

export function SignOutButton() {
  const { logout } = useAuth();

  // End the session at the backend BFF (clears the httponly cookie).
  const handleSignOut = () => {
    logout();
  };

  return (
    <Button variant="outline" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
