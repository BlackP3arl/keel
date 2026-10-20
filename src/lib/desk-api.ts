import { parseDesk } from "@/lib/desk-parse";
import { getStoredDesk, saveStoredDesk } from "@/lib/db";
import { requireAllowlistedSession } from "@/lib/guard";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function getDesk(): Promise<Response> {
  const session = await requireAllowlistedSession();
  if (!session.ok) return jsonError(session.error, session.status);

  try {
    const stored = await getStoredDesk();
    if (stored === null) {
      return Response.json({ empty: true, desk: null });
    }
    const parsed = parseDesk(stored);
    if (!parsed.ok) {
      return jsonError(`Stored desk could not be read: ${parsed.reason}`, 500);
    }
    return Response.json({ empty: false, desk: parsed.desk, skipped: parsed.skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The desk could not be loaded.";
    return jsonError(message, 500);
  }
}

export async function putDesk(request: Request): Promise<Response> {
  const session = await requireAllowlistedSession();
  if (!session.ok) return jsonError(session.error, session.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Desk JSON is not valid.", 400);
  }

  const parsed = parseDesk(body);
  if (!parsed.ok) return jsonError(parsed.reason, 400);

  try {
    await saveStoredDesk(parsed.desk);
    return Response.json({ ok: true, desk: parsed.desk, skipped: parsed.skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The desk could not be saved.";
    return jsonError(message, 500);
  }
}
