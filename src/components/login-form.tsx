"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function errorCopy(code: string | null): string | null {
  if (!code) return null;
  if (code === "AccessDenied") return "That Google account is not on the allowlist.";
  if (code === "Configuration") return "Sign-in is not configured. Check AUTH_SECRET and Google OAuth env vars.";
  return "Sign-in did not finish. Try again.";
}

export function LoginForm() {
  const params = useSearchParams();
  const message = errorCopy(params.get("error"));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6">
        <p className="font-heading text-2xl tracking-tight">Keel</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery desk. Sign in with a Google account on the allowlist.
        </p>
        {message ? (
          <p role="alert" className="mt-4 text-sm text-destructive" data-testid="login-error">
            {message}
          </p>
        ) : null}
        <Button
          className="mt-6 w-full"
          data-testid="google-sign-in"
          onClick={() => void signIn("google", { callbackUrl: "/" })}
        >
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
