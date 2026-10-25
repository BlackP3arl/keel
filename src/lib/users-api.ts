import {
  canAddManagedUser,
  canChangeManagedRole,
  canRemoveManagedUser,
  mergeManagedUsers,
  parseUserEmail,
} from "@/lib/access";
import { requireAdminSession } from "@/lib/guard";
import { isAppRole, type AppRole } from "@/lib/roles";
import { deleteStoredUser, listStoredUsers, upsertStoredUser } from "@/lib/users";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

async function loadUsers() {
  return mergeManagedUsers(await listStoredUsers());
}

export async function getUsers(): Promise<Response> {
  const session = await requireAdminSession();
  if (!session.ok) return jsonError(session.error, session.status);

  try {
    return Response.json({ users: await loadUsers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Users could not be loaded.";
    return jsonError(message, 500);
  }
}

export async function postUser(request: Request): Promise<Response> {
  const session = await requireAdminSession();
  if (!session.ok) return jsonError(session.error, session.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("User JSON is not valid.", 400);
  }

  const record = body && typeof body === "object" ? (body as { email?: unknown; role?: unknown }) : {};
  const email = parseUserEmail(record.email);
  if (!email) return jsonError("Give a valid Google email address.", 400);
  if (!isAppRole(record.role)) return jsonError("Role must be admin or viewer.", 400);

  try {
    const users = await loadUsers();
    const allowed = canAddManagedUser(users, email);
    if (!allowed.ok) return jsonError(allowed.error, 400);
    await upsertStoredUser(email, record.role);
    return Response.json({ ok: true, users: await loadUsers() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The user could not be added.";
    return jsonError(message, 500);
  }
}

export async function patchUser(emailParam: string, request: Request): Promise<Response> {
  const session = await requireAdminSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const email = parseUserEmail(emailParam);
  if (!email) return jsonError("Give a valid Google email address.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("User JSON is not valid.", 400);
  }

  const role = body && typeof body === "object" ? (body as { role?: unknown }).role : undefined;
  if (!isAppRole(role)) return jsonError("Role must be admin or viewer.", 400);

  try {
    const users = await loadUsers();
    const allowed = canChangeManagedRole(users, email, role as AppRole);
    if (!allowed.ok) return jsonError(allowed.error, 400);
    await upsertStoredUser(email, role);
    return Response.json({ ok: true, users: await loadUsers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The user could not be updated.";
    return jsonError(message, 500);
  }
}

export async function deleteUser(emailParam: string): Promise<Response> {
  const session = await requireAdminSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const email = parseUserEmail(emailParam);
  if (!email) return jsonError("Give a valid Google email address.", 400);

  try {
    const users = await loadUsers();
    const allowed = canRemoveManagedUser(users, email);
    if (!allowed.ok) return jsonError(allowed.error, 400);
    await deleteStoredUser(email);
    return Response.json({ ok: true, users: await loadUsers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The user could not be removed.";
    return jsonError(message, 500);
  }
}
