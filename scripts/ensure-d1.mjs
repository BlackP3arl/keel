#!/usr/bin/env node
/**
 * Create the remote D1 database `keel` if it is missing, then write its id into wrangler.jsonc.
 * Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Non-interactive.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerPath = join(root, "wrangler.jsonc");
const wranglerBin = join(root, "node_modules", ".bin", "wrangler");

function wrangler(args) {
  return execFileSync(wranglerBin, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseList(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.result)) return parsed.result;
  return [];
}

function idOf(row) {
  return row?.uuid ?? row?.id ?? null;
}

function nameOf(row) {
  return row?.name ?? row?.database_name ?? "";
}

let existing = [];
try {
  existing = parseList(wrangler(["d1", "list", "--json"]));
} catch (error) {
  const stderr = error instanceof Error && "stderr" in error ? String(error.stderr) : "";
  throw new Error(`wrangler d1 list failed.\n${stderr || (error instanceof Error ? error.message : error)}`);
}

let id = idOf(existing.find((row) => nameOf(row) === "keel"));
if (!id) {
  let created;
  try {
    created = wrangler(["d1", "create", "keel"]);
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr) : "";
    throw new Error(`wrangler d1 create keel failed.\n${stderr || (error instanceof Error ? error.message : error)}`);
  }
  const match =
    created.match(/database_id\s*=\s*"([^"]+)"/) ??
    created.match(/"uuid"\s*:\s*"([^"]+)"/) ??
    created.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!match) {
    throw new Error(`Could not read the D1 id from:\n${created}`);
  }
  id = match[1] ?? match[0];
}

const current = readFileSync(wranglerPath, "utf8");
const next = current.replace(/"database_id":\s*"[^"]+"/, `"database_id": "${id}"`);
if (next === current && !current.includes(id)) {
  throw new Error("wrangler.jsonc has no database_id field to replace.");
}
writeFileSync(wranglerPath, next);
process.stdout.write(`D1 database keel is ${id}\n`);
