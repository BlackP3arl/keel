import { auth } from "@/auth";
import { isAllowlisted } from "@/lib/allowlist";

export type SessionCheck =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requireAllowlistedSession(): Promise<SessionCheck> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, status: 401, error: "Sign in required." };
  if (!isAllowlisted(email)) {
    return { ok: false, status: 403, error: "This account is not allowed to use Keel." };
  }
  return { ok: true, email };
}
