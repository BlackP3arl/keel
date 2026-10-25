import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredUser } from "@/lib/users";

const {
  authMock,
  findStoredRoleMock,
  listStoredUsersMock,
  upsertStoredUserMock,
  deleteStoredUserMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findStoredRoleMock: vi.fn(),
  listStoredUsersMock: vi.fn(),
  upsertStoredUserMock: vi.fn(),
  deleteStoredUserMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/users", () => ({
  findStoredRole: (...args: unknown[]) => findStoredRoleMock(...args),
  listStoredUsers: () => listStoredUsersMock(),
  upsertStoredUser: (...args: unknown[]) => upsertStoredUserMock(...args),
  deleteStoredUser: (...args: unknown[]) => deleteStoredUserMock(...args),
}));

import { deleteUser, getUsers, patchUser, postUser } from "@/lib/users-api";

describe("user APIs", () => {
  beforeEach(() => {
    authMock.mockReset();
    findStoredRoleMock.mockReset();
    listStoredUsersMock.mockReset();
    upsertStoredUserMock.mockReset();
    deleteStoredUserMock.mockReset();
    findStoredRoleMock.mockResolvedValue(null);
    listStoredUsersMock.mockResolvedValue([]);
    delete process.env.ALLOWED_EMAILS;
  });

  it("rejects missing sessions and viewers", async () => {
    authMock.mockResolvedValue(null);
    expect((await getUsers()).status).toBe(401);

    authMock.mockResolvedValue({ user: { email: "view@example.com" } });
    findStoredRoleMock.mockResolvedValue("viewer");
    expect((await getUsers()).status).toBe(403);
    expect(
      (
        await postUser(
          new Request("http://keel.test/api/users", {
            method: "POST",
            body: JSON.stringify({ email: "new@example.com", role: "viewer" }),
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("lists bootstrap admins plus stored users for an admin", async () => {
    authMock.mockResolvedValue({ user: { email: "salle.kma@gmail.com" } });
    const stored: StoredUser[] = [{ email: "view@example.com", role: "viewer" }];
    listStoredUsersMock.mockResolvedValue(stored);

    const res = await getUsers();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: { email: string; role: string; bootstrap: boolean }[] };
    expect(body.users).toEqual([
      { email: "salle.kma@gmail.com", role: "admin", bootstrap: true },
      { email: "view@example.com", role: "viewer", bootstrap: false },
    ]);
  });

  it("adds a viewer and refuses a bootstrap email", async () => {
    authMock.mockResolvedValue({ user: { email: "salle.kma@gmail.com" } });
    const stored: StoredUser[] = [];
    listStoredUsersMock.mockImplementation(async () => stored);
    upsertStoredUserMock.mockImplementation(async (email: string, role: StoredUser["role"]) => {
      stored.push({ email, role });
    });

    const created = await postUser(
      new Request("http://keel.test/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "View@example.com", role: "viewer" }),
      }),
    );
    expect(created.status).toBe(201);
    expect(upsertStoredUserMock).toHaveBeenCalledWith("view@example.com", "viewer");

    const blocked = await postUser(
      new Request("http://keel.test/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "salle.kma@gmail.com", role: "viewer" }),
      }),
    );
    expect(blocked.status).toBe(400);
  });

  it("will not demote or remove a bootstrap admin", async () => {
    authMock.mockResolvedValue({ user: { email: "salle.kma@gmail.com" } });
    listStoredUsersMock.mockResolvedValue([]);

    const patch = await patchUser(
      "salle.kma@gmail.com",
      new Request("http://keel.test/api/users/salle.kma@gmail.com", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      }),
    );
    expect(patch.status).toBe(400);
    expect(upsertStoredUserMock).not.toHaveBeenCalled();

    const removed = await deleteUser("salle.kma@gmail.com");
    expect(removed.status).toBe(400);
    expect(deleteStoredUserMock).not.toHaveBeenCalled();
  });
});
