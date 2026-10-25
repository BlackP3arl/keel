import { describe, expect, it } from "vitest";
import { deleteStoredUser, findStoredRole, listStoredUsers, upsertStoredUser } from "@/lib/users";
import type { D1Like } from "@/lib/db";

function memoryUsers(): D1Like & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T extends Record<string, unknown>>() {
              if (query.includes("FROM keel_users") && query.includes("WHERE email")) {
                const email = String(values[0]);
                const role = rows.get(email);
                return (role === undefined ? null : ({ role } as unknown as T));
              }
              return null;
            },
            async run() {
              if (query.includes("DELETE FROM keel_users")) {
                rows.delete(String(values[0]));
                return { success: true };
              }
              rows.set(String(values[0]), String(values[1]));
              return { success: true };
            },
            async all<T extends Record<string, unknown>>() {
              const results = [...rows.entries()]
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([email, role]) => ({ email, role })) as unknown as T[];
              return { results };
            },
          };
        },
      };
    },
  };
}

describe("D1 user storage", () => {
  it("writes, lists, updates, and deletes authorized users", async () => {
    const db = memoryUsers();
    expect(await findStoredRole("lead@example.com", db)).toBeNull();
    await upsertStoredUser("Lead@example.com", "admin", db);
    await upsertStoredUser("view@example.com", "viewer", db);
    expect(await findStoredRole("lead@example.com", db)).toBe("admin");
    expect(await listStoredUsers(db)).toEqual([
      { email: "lead@example.com", role: "admin" },
      { email: "view@example.com", role: "viewer" },
    ]);
    await upsertStoredUser("view@example.com", "admin", db);
    expect(await findStoredRole("view@example.com", db)).toBe("admin");
    await deleteStoredUser("view@example.com", db);
    expect(await findStoredRole("view@example.com", db)).toBeNull();
  });
});
