import { afterEach, describe, expect, it } from "vitest";
import {
  canAddManagedUser,
  canChangeManagedRole,
  canRemoveManagedUser,
  mergeManagedUsers,
  parseUserEmail,
  resolveAccess,
} from "@/lib/access";
import { DEFAULT_ALLOWED_EMAIL } from "@/lib/allowlist";

describe("access", () => {
  afterEach(() => {
    delete process.env.ALLOWED_EMAILS;
  });

  it("treats ALLOWED_EMAILS as bootstrap admins even without a D1 row", () => {
    const access = resolveAccess("salle.kma@gmail.com", null, undefined);
    expect(access).toEqual({ ok: true, email: DEFAULT_ALLOWED_EMAIL, role: "admin", bootstrap: true });
  });

  it("authorizes a stored viewer and a stored admin", () => {
    expect(resolveAccess("view@example.com", "viewer", "owner@example.com")).toMatchObject({
      ok: true,
      role: "viewer",
      bootstrap: false,
    });
    expect(resolveAccess("lead@example.com", "admin", "owner@example.com")).toMatchObject({
      ok: true,
      role: "admin",
      bootstrap: false,
    });
  });

  it("prefers the bootstrap admin role over a stored viewer row", () => {
    const access = resolveAccess("owner@example.com", "viewer", "owner@example.com");
    expect(access).toMatchObject({ ok: true, role: "admin", bootstrap: true });
  });

  it("rejects unknown emails", () => {
    expect(resolveAccess("stranger@example.com", null, "owner@example.com")).toEqual({ ok: false });
    expect(resolveAccess(null, "admin")).toEqual({ ok: false });
  });

  it("parses Google emails and rejects junk", () => {
    expect(parseUserEmail("  Name@Gmail.com ")).toBe("name@gmail.com");
    expect(parseUserEmail("not-an-email")).toBeNull();
    expect(parseUserEmail(12)).toBeNull();
  });

  it("merges bootstrap emails ahead of stored users and cannot lock them out", () => {
    const users = mergeManagedUsers(
      [
        { email: "viewer@example.com", role: "viewer" },
        { email: "salle.kma@gmail.com", role: "viewer" },
      ],
      undefined,
    );
    expect(users[0]).toEqual({ email: DEFAULT_ALLOWED_EMAIL, role: "admin", bootstrap: true });
    expect(canChangeManagedRole(users, DEFAULT_ALLOWED_EMAIL, "viewer").ok).toBe(false);
    expect(canRemoveManagedUser(users, DEFAULT_ALLOWED_EMAIL).ok).toBe(false);
    expect(canAddManagedUser(users, DEFAULT_ALLOWED_EMAIL).ok).toBe(false);
  });

  it("blocks demoting or removing the last admin", () => {
    const users = mergeManagedUsers([{ email: "only@example.com", role: "admin" }], " ");
    // empty ALLOWED_EMAILS falls back to the default bootstrap admin
    expect(users.some((user) => user.email === DEFAULT_ALLOWED_EMAIL && user.bootstrap)).toBe(true);

    const lone = [
      { email: "only@example.com", role: "admin" as const, bootstrap: false },
    ];
    expect(canChangeManagedRole(lone, "only@example.com", "viewer")).toMatchObject({ ok: false });
    expect(canRemoveManagedUser(lone, "only@example.com")).toMatchObject({ ok: false });
  });

  it("allows removing a viewer or demoting an extra admin", () => {
    const users = [
      { email: "boss@example.com", role: "admin" as const, bootstrap: false },
      { email: "other@example.com", role: "admin" as const, bootstrap: false },
      { email: "view@example.com", role: "viewer" as const, bootstrap: false },
    ];
    expect(canRemoveManagedUser(users, "view@example.com").ok).toBe(true);
    expect(canChangeManagedRole(users, "boss@example.com", "viewer").ok).toBe(true);
  });
});
