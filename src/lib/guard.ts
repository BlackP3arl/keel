import { auth } from "@/auth";
import { resolveSessionAccess, type AccessOk } from "@/lib/access";

export type SessionCheck =
  | (AccessOk & { ok: true })
  | { ok: false; status: 401 | 403; error: string };

export async function requireAuthorizedSession(): Promise<SessionCheck> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, status: 401, error: "Sign in required." };
  const access = await resolveSessionAccess(email);
  if (!access.ok) {
    return { ok: false, status: 403, error: "This account is not allowed to use Keel." };
  }
  return access;
}

export async function requireWriteSession(): Promise<SessionCheck> {
  const session = await requireAuthorizedSession();
  if (!session.ok) return session;
  if (session.role !== "admin") {
    return { ok: false, status: 403, error: "Viewers can look at the desk but cannot change it." };
  }
  return session;
}

export async function requireAdminSession(): Promise<SessionCheck> {
  const session = await requireAuthorizedSession();
  if (!session.ok) return session;
  if (session.role !== "admin") {
    return { ok: false, status: 403, error: "Only admins can manage users." };
  }
  return session;
}
