import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedData } from "@/lib/seed";
import type { DeskState, Project } from "@/lib/types";

const { authMock, getStoredDeskMock, saveStoredDeskMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getStoredDeskMock: vi.fn(),
  saveStoredDeskMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/db", () => ({
  getStoredDesk: () => getStoredDeskMock(),
  saveStoredDesk: (desk: DeskState) => saveStoredDeskMock(desk),
}));

import { getDesk, putDesk } from "@/lib/desk-api";

function sampleDesk(): DeskState {
  const seed = seedData();
  const project: Project = {
    id: "proj-persist",
    name: "Server desk",
    summary: "Must survive a reload",
    status: "active",
    start: "2026-02-01",
    due: "2026-04-01",
    predecessorProjectId: null,
    ownerId: seed.developers[0]?.id ?? "sham",
  };
  return { ...seed, projects: [project], tasks: [], comments: [] };
}

describe("desk APIs", () => {
  beforeEach(() => {
    authMock.mockReset();
    getStoredDeskMock.mockReset();
    saveStoredDeskMock.mockReset();
    delete process.env.ALLOWED_EMAILS;
  });

  it("GET returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    const res = await getDesk();
    expect(res.status).toBe(401);
    expect(getStoredDeskMock).not.toHaveBeenCalled();
  });

  it("PUT returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    const res = await putDesk(
      new Request("http://keel.test/api/desk", {
        method: "PUT",
        body: JSON.stringify(sampleDesk()),
      }),
    );
    expect(res.status).toBe(401);
    expect(saveStoredDeskMock).not.toHaveBeenCalled();
  });

  it("rejects an allowlisted-looking request that is not signed in", async () => {
    authMock.mockResolvedValue({ user: { email: null } });
    const res = await getDesk();
    expect(res.status).toBe(401);
  });

  it("rejects a signed-in email that is not on the allowlist", async () => {
    authMock.mockResolvedValue({ user: { email: "stranger@example.com" } });
    const res = await getDesk();
    expect(res.status).toBe(403);
    expect(getStoredDeskMock).not.toHaveBeenCalled();
  });

  it("saves a desk and returns the same records on the next GET", async () => {
    let stored: unknown = null;
    authMock.mockResolvedValue({ user: { email: "salle.kma@gmail.com" } });
    getStoredDeskMock.mockImplementation(async () => stored);
    saveStoredDeskMock.mockImplementation(async (desk: DeskState) => {
      stored = desk;
    });

    const desk = sampleDesk();
    const put = await putDesk(
      new Request("http://keel.test/api/desk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(desk),
      }),
    );
    expect(put.status).toBe(200);

    const get = await getDesk();
    expect(get.status).toBe(200);
    const body = (await get.json()) as { empty: boolean; desk: DeskState };
    expect(body.empty).toBe(false);
    expect(body.desk.projects).toEqual(desk.projects);
    expect(body.desk.projects[0]?.name).toBe("Server desk");
  });
});
