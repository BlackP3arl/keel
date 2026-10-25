import { normalizeEmail } from "@/lib/allowlist";
import { getD1, type D1Like } from "@/lib/db";
import { isAppRole, type AppRole } from "@/lib/roles";

export type StoredUser = {
  email: string;
  role: AppRole;
};

function client(db?: D1Like): Promise<D1Like> {
  return db ? Promise.resolve(db) : getD1();
}

export async function findStoredRole(email: string, db?: D1Like): Promise<AppRole | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  try {
    const row = await (await client(db))
      .prepare("SELECT role FROM keel_users WHERE email = ?")
      .bind(normalized)
      .first<{ role?: string }>();
    return isAppRole(row?.role) ? row.role : null;
  } catch {
    return null;
  }
}

export async function listStoredUsers(db?: D1Like): Promise<StoredUser[]> {
  const result = await (await client(db))
    .prepare("SELECT email, role FROM keel_users ORDER BY email")
    .bind()
    .all<{ email?: string; role?: string }>();
  return (result.results ?? [])
    .map((row) => {
      const email = typeof row.email === "string" ? normalizeEmail(row.email) : "";
      if (!email || !isAppRole(row.role)) return null;
      return { email, role: row.role };
    })
    .filter((row): row is StoredUser => row !== null);
}

export async function upsertStoredUser(email: string, role: AppRole, db?: D1Like): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isAppRole(role)) throw new Error("Email and role are required.");
  await (await client(db))
    .prepare(
      `INSERT INTO keel_users (email, role, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(email) DO UPDATE SET role = excluded.role, updated_at = datetime('now')`,
    )
    .bind(normalized, role)
    .run();
}

export async function deleteStoredUser(email: string, db?: D1Like): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await (await client(db)).prepare("DELETE FROM keel_users WHERE email = ?").bind(normalized).run();
}
