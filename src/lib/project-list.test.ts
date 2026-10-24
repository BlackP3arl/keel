import { describe, expect, it } from "vitest";
import { buildProjectListRows, filterAndSortProjectRows } from "@/lib/project-list";
import type { Developer, Project, Task } from "@/lib/types";

const owner: Developer = {
  id: "lead",
  name: "Ahmed Salam",
  role: "CTO",
  department: "IT",
  email: "",
};

function project(id: string, name: string, status: Project["status"], due: string): Project {
  return {
    id,
    name,
    summary: "",
    status,
    start: "2026-01-01",
    due,
    predecessorProjectId: null,
    ownerId: "lead",
  };
}

function task(id: string, projectId: string, status: Task["status"]): Task {
  return {
    id,
    projectId,
    title: id,
    assigneeId: "lead",
    status,
    start: "2026-01-01",
    due: "2026-01-02",
    predecessorTaskId: null,
    priority: "medium",
  };
}

const projects = [
  project("a", "Alpha", "active", "2026-06-01"),
  project("b", "Beta", "on_hold", "2026-03-01"),
  project("c", "Gamma", "done", "2026-02-01"),
];

const tasks = [
  task("t1", "a", "todo"),
  task("t2", "a", "done"),
  task("t3", "c", "done"),
];

describe("project list", () => {
  const today = new Date("2026-04-01");
  const rows = buildProjectListRows(projects, tasks, new Map([["lead", owner]]), today);

  it("counts tasks and progress from the desk records", () => {
    const alpha = rows.find((row) => row.project.id === "a");
    expect(alpha?.tasks).toHaveLength(2);
    expect(alpha?.doneCount).toBe(1);
    expect(alpha?.progress).toBe(0.5);
  });

  it("filters by project status", () => {
    const held = filterAndSortProjectRows(rows, {
      status: "on_hold",
      query: "",
      sortKey: "name",
      sortDir: "asc",
    });
    expect(held.map((row) => row.project.name)).toEqual(["Beta"]);
  });

  it("sorts by due date", () => {
    const byDue = filterAndSortProjectRows(rows, {
      status: "all",
      query: "",
      sortKey: "due",
      sortDir: "asc",
    });
    expect(byDue.map((row) => row.project.name)).toEqual(["Gamma", "Beta", "Alpha"]);
  });
});
