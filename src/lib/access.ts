import { allowedEmails, isBootstrapAdmin, normalizeEmail } from "@/lib/allowlist";
import { isAppRole, type AppRole } from "@/lib/roles";
import { findStoredRole, type StoredUser } from "@/lib/users";

export type AccessOk = { ok: true; email: string; role: AppRole; bootstrap: boolean };
export type AccessDenied = { ok: false };
export type Access = AccessOk | AccessDenied;

export type ManagedUser = {
  email: string;
  role: AppRole;
  bootstrap: boolean;
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseUserEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = normalizeEmail(raw);
  if (!EMAIL_SHAPE.test(email)) return null;
  return email;
}

export function resolveAccess(
  email: string | null | undefined,
  storedRole: AppRole | null,
  bootstrapRaw = process.env.ALLOWED_EMAILS,
): Access {
  if (!email) return { ok: false };
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false };
  if (isBootstrapAdmin(normalized, bootstrapRaw)) {
    return { ok: true, email: normalized, role: "admin", bootstrap: true };
  }
  if (isAppRole(storedRole)) {
    return { ok: true, email: normalized, role: storedRole, bootstrap: false };
  }
  return { ok: false };
}

export async function resolveSessionAccess(email: string | null | undefined): Promise<Access> {
  if (!email) return { ok: false };
  const normalized = normalizeEmail(email);
  if (isBootstrapAdmin(normalized)) {
    return { ok: true, email: normalized, role: "admin", bootstrap: true };
  }
  let stored: AppRole | null = null;
  try {
    stored = await findStoredRole(normalized);
  } catch {
    stored = null;
  }
  return resolveAccess(normalized, stored);
}

export function mergeManagedUsers(stored: StoredUser[], bootstrapRaw = process.env.ALLOWED_EMAILS): ManagedUser[] {
  const byEmail = new Map<string, ManagedUser>();
  for (const email of allowedEmails(bootstrapRaw)) {
    byEmail.set(email, { email, role: "admin", bootstrap: true });
  }
  for (const user of stored) {
    if (byEmail.has(user.email)) continue;
    byEmail.set(user.email, { email: user.email, role: user.role, bootstrap: false });
  }
  return [...byEmail.values()].sort((left, right) => {
    if (left.bootstrap !== right.bootstrap) return left.bootstrap ? -1 : 1;
    return left.email.localeCompare(right.email);
  });
}

export function adminCount(users: ManagedUser[]): number {
  return users.filter((user) => user.role === "admin").length;
}

export function canChangeManagedRole(
  users: ManagedUser[],
  email: string,
  nextRole: AppRole,
): { ok: true } | { ok: false; error: string } {
  const current = users.find((user) => user.email === email);
  if (!current) return { ok: false, error: "That user is not on the list." };
  if (current.bootstrap) return { ok: false, error: "Bootstrap admins cannot be demoted or removed." };
  if (current.role === nextRole) return { ok: true };
  if (current.role === "admin" && nextRole === "viewer" && adminCount(users) <= 1) {
    return { ok: false, error: "The last admin cannot be demoted." };
  }
  return { ok: true };
}

export function canRemoveManagedUser(
  users: ManagedUser[],
  email: string,
): { ok: true } | { ok: false; error: string } {
  const current = users.find((user) => user.email === email);
  if (!current) return { ok: false, error: "That user is not on the list." };
  if (current.bootstrap) return { ok: false, error: "Bootstrap admins cannot be demoted or removed." };
  if (current.role === "admin" && adminCount(users) <= 1) {
    return { ok: false, error: "The last admin cannot be removed." };
  }
  return { ok: true };
}

export function canAddManagedUser(
  users: ManagedUser[],
  email: string,
): { ok: true } | { ok: false; error: string } {
  if (users.some((user) => user.email === email)) {
    return { ok: false, error: "That email is already authorized." };
  }
  return { ok: true };
}
