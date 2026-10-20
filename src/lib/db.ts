import { neon } from "@neondatabase/serverless";
import { parseDesk } from "@/lib/desk-parse";
import type { DeskState } from "@/lib/types";

const DESK_ID = "default";

type Sql = ReturnType<typeof neon>;

let sqlClient: Sql | null = null;
let tableReady = false;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add Neon in the Vercel Marketplace and pull env vars.");
  }
  return url;
}

function sql(): Sql {
  if (!sqlClient) sqlClient = neon(databaseUrl());
  return sqlClient;
}

async function ensureTable(): Promise<Sql> {
  const client = sql();
  if (!tableReady) {
    await client.query(
      `CREATE TABLE IF NOT EXISTS keel_desk (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    );
    tableReady = true;
  }
  return client;
}

/** `null` means the server has never stored a desk. */
export async function getStoredDesk(): Promise<unknown | null> {
  const client = await ensureTable();
  const rows = (await client.query("SELECT data FROM keel_desk WHERE id = $1", [DESK_ID])) as Array<{
    data?: unknown;
  }>;
  const row = rows[0];
  if (!row) return null;
  return row.data ?? null;
}

export async function saveStoredDesk(desk: DeskState): Promise<void> {
  const parsed = parseDesk(desk);
  if (!parsed.ok) throw new Error(parsed.reason);
  const client = await ensureTable();
  await client.query(
    `INSERT INTO keel_desk (id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [DESK_ID, JSON.stringify(parsed.desk)],
  );
}
