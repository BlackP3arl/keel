import { describe, expect, it } from "vitest";
import { canPersist, parseDesk, parseDeskJson } from "@/lib/desk-parse";
import { seedData } from "@/lib/seed";
import type { DeskState, Project, Task } from "@/lib/types";

function validDesk(overrides: Partial<DeskState> = {}): DeskState {
  const seed = seedData();
  const ownerId = seed.developers[0]?.id ?? "sham";
  const project: Project = {
    id: "proj-1",
    name: "Pension portal",
    summary: "Core work",
    status: "active",
    start: "2026-01-01",
    due: "2026-03-01",
    predecessorProjectId: null,
    ownerId,
  };
  const task: Task = {
    id: "task-1",
    projectId: "proj-1",
    title: "Draw the Gantt",
    assigneeId: ownerId,
    status: "todo",
    start: "2026-01-01",
    due: "2026-01-15",
    predecessorTaskId: null,
    priority: "medium",
  };
  return {
    developers: seed.developers,
    projects: [project],
    tasks: [task],
    comments: [],
    ...overrides,
  };
}

describe("parseDesk", () => {
  it("keeps a valid desk", () => {
    const desk = validDesk();
    const parsed = parseDesk(desk);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.desk.projects).toHaveLength(1);
    expect(parsed.desk.tasks).toHaveLength(1);
    expect(parsed.skipped).toEqual({ developers: 0, projects: 0, tasks: 0, comments: 0 });
  });

  it("skips one bad project instead of discarding the whole desk", () => {
    const desk = validDesk({
      projects: [
        validDesk().projects[0],
        { id: "broken" } as unknown as Project,
      ],
    });
    const parsed = parseDesk(desk);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.desk.projects.map((project) => project.id)).toEqual(["proj-1"]);
    expect(parsed.desk.tasks).toHaveLength(1);
    expect(parsed.skipped.projects).toBe(1);
  });

  it("drops tasks whose project is missing and clears broken predecessor ids", () => {
    const desk = validDesk({
      projects: [
        {
          ...validDesk().projects[0],
          predecessorProjectId: "gone-project",
        },
      ],
      tasks: [
        validDesk().tasks[0],
        {
          id: "orphan",
          projectId: "missing",
          title: "Orphan",
          assigneeId: "sham",
          status: "todo",
          start: "2026-01-01",
          due: "2026-01-02",
          predecessorTaskId: null,
          priority: "low",
        },
        {
          id: "task-2",
          projectId: "proj-1",
          title: "Follow on",
          assigneeId: "sham",
          status: "todo",
          start: "2026-01-02",
          due: "2026-01-03",
          predecessorTaskId: "missing-task",
          priority: "low",
        },
      ],
    });
    const parsed = parseDesk(desk);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.desk.projects[0]?.predecessorProjectId).toBeNull();
    expect(parsed.desk.tasks.map((task) => task.id).sort()).toEqual(["task-1", "task-2"]);
    expect(parsed.desk.tasks.find((task) => task.id === "task-2")?.predecessorTaskId).toBeNull();
  });

  it("fails closed on garbage so callers must not overwrite storage", () => {
    expect(parseDesk(null).ok).toBe(false);
    expect(parseDesk("nope").ok).toBe(false);
    expect(parseDeskJson("{").ok).toBe(false);
    expect(parseDesk({ developers: [], projects: "nope", tasks: [] }).ok).toBe(false);
  });
});

describe("canPersist", () => {
  it("never writes after a failed load", () => {
    expect(canPersist("failed")).toBe(false);
    expect(canPersist("ok")).toBe(true);
    expect(canPersist("empty")).toBe(true);
    expect(canPersist("pending")).toBe(false);
  });
});
