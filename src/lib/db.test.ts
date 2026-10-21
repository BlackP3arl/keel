import { describe, expect, it } from "vitest";
import { decodeStoredData, getStoredDesk, saveStoredDesk, type D1Like } from "@/lib/db";
import { seedData } from "@/lib/seed";
import type { DeskState, Project } from "@/lib/types";

function memoryD1(): D1Like & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T extends Record<string, unknown>>() {
              if (query.includes("SELECT")) {
                const id = String(values[0]);
                const data = store.get(id);
                return (data === undefined ? null : ({ data } as unknown as T));
              }
              return null;
            },
            async run() {
              const id = String(values[0]);
              const data = String(values[1]);
              store.set(id, data);
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function sampleDesk(): DeskState {
  const seed = seedData();
  const project: Project = {
    id: "proj-d1",
    name: "Cloudflare desk",
    summary: "Survives a reload in D1",
    status: "active",
    start: "2026-02-01",
    due: "2026-04-01",
    predecessorProjectId: null,
    ownerId: seed.developers[0]?.id ?? "sham",
  };
  return { ...seed, projects: [project], tasks: [], comments: [] };
}

describe("D1 desk storage", () => {
  it("decodes JSON text rows and leaves objects alone", () => {
    expect(decodeStoredData('{"projects":[]}')).toEqual({ projects: [] });
    expect(decodeStoredData({ projects: [] })).toEqual({ projects: [] });
  });

  it("writes a desk and reads the same records back", async () => {
    const db = memoryD1();
    expect(await getStoredDesk(db)).toBeNull();
    const desk = sampleDesk();
    await saveStoredDesk(desk, db);
    const loaded = await getStoredDesk(db);
    expect(loaded).toMatchObject({ projects: desk.projects });
  });
});
