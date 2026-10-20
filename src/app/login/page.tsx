import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Opening sign-in…</p>}>
      <LoginForm />
    </Suspense>
  );
}
