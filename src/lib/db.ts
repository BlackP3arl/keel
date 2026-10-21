import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseDesk } from "@/lib/desk-parse";
import type { DeskState } from "@/lib/types";

const DESK_ID = "default";

/** Minimal D1 surface used by the desk. Tests can pass an in-memory stand-in. */
export type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T extends Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export function decodeStoredData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
}

async function getD1(): Promise<D1Like> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) {
    throw new Error("Cloudflare D1 binding DB is missing. Bind the `keel` database as DB.");
  }
  return db;
}

/** `null` means the server has never stored a desk. */
export async function getStoredDesk(db?: D1Like): Promise<unknown | null> {
  const client = db ?? (await getD1());
  const row = await client.prepare("SELECT data FROM keel_desk WHERE id = ?").bind(DESK_ID).first<{ data?: unknown }>();
  if (!row || row.data == null) return null;
  return decodeStoredData(row.data);
}

export async function saveStoredDesk(desk: DeskState, db?: D1Like): Promise<void> {
  const parsed = parseDesk(desk);
  if (!parsed.ok) throw new Error(parsed.reason);
  const client = db ?? (await getD1());
  await client
    .prepare(
      `INSERT INTO keel_desk (id, data, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
    )
    .bind(DESK_ID, JSON.stringify(parsed.desk))
    .run();
}
