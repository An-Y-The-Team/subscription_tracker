"use client";

import { Button } from "@/components/ui/button";

import { useAuth } from "../../auth-provider";

interface SignInButtonProps {
  /** Path to return to after login completes. */
  redirectTo?: string;
}

export function SignInButton({ redirectTo }: SignInButtonProps) {
  const { login } = useAuth();

  // Start the OIDC login flow at the backend BFF.
  const handleSignIn = () => {
    login(redirectTo);
  };

  return <Button onClick={handleSignIn}>Sign in</Button>;
}
