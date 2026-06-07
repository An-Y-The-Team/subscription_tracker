import { SignInButton } from "@/features/auth/components/sign-in-button/sign-in-button";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Subscription Tracker
        </h1>
        <p className="text-muted-foreground text-sm">
          Sign in with your Authentik account to continue.
        </p>
      </div>
      <SignInButton />
    </div>
  );
}
