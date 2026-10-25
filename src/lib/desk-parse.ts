import { ensureSeededRoster, seedData } from "@/lib/seed";
import type { Comment, Department, DeskState, Developer, Project, Task } from "@/lib/types";

export type ParseSuccess = {
  ok: true;
  desk: DeskState;
  skipped: { developers: number; projects: number; tasks: number; comments: number };
};

export type ParseFailure = { ok: false; reason: string };

export type ParseResult = ParseSuccess | ParseFailure;

export type LoadStatus = "pending" | "ok" | "empty" | "failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDepartment(value: string): value is Department {
  return (
    value === "Software Engineering" ||
    value === "Data Services" ||
    value === "Cloud & Security" ||
    value === "IT"
  );
}

export function isDeveloper(value: unknown): value is Developer {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.role === "string" &&
    typeof value.department === "string" &&
    isDepartment(value.department) &&
    typeof value.email === "string" &&
    (value.email.length === 0 || value.email.includes("@"))
  );
}

export function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.summary === "string" &&
    (value.status === "active" || value.status === "on_hold" || value.status === "done") &&
    typeof value.start === "string" &&
    typeof value.due === "string" &&
    typeof value.ownerId === "string" &&
    (value.predecessorProjectId === null || typeof value.predecessorProjectId === "string")
  );
}

export function isComment(value: unknown): value is Comment {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.taskId === "string" &&
    value.taskId.length > 0 &&
    typeof value.body === "string" &&
    value.body.trim().length > 0 &&
    typeof value.createdAt === "string" &&
    value.createdAt.length > 0 &&
    typeof value.authorId === "string"
  );
}

export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const statuses = ["backlog", "todo", "in_progress", "in_review", "done"];
  const priorities = ["low", "medium", "high"];
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.projectId === "string" &&
    typeof value.title === "string" &&
    typeof value.assigneeId === "string" &&
    statuses.includes(String(value.status)) &&
    priorities.includes(String(value.priority)) &&
    typeof value.start === "string" &&
    typeof value.due === "string" &&
    (value.predecessorTaskId === null || typeof value.predecessorTaskId === "string")
  );
}

function repairProjects(projects: Project[]): Project[] {
  const ids = new Set(projects.map((project) => project.id));
  return projects.map((project) =>
    project.predecessorProjectId && !ids.has(project.predecessorProjectId)
      ? { ...project, predecessorProjectId: null }
      : project,
  );
}

function repairTasks(tasks: Task[], projectIds: Set<string>): Task[] {
  const kept = tasks.filter((task) => projectIds.has(task.projectId));
  const ids = new Set(kept.map((task) => task.id));
  return kept.map((task) => {
    let predecessorTaskId = task.predecessorTaskId;
    if (predecessorTaskId && !ids.has(predecessorTaskId)) predecessorTaskId = null;
    return predecessorTaskId === task.predecessorTaskId ? task : { ...task, predecessorTaskId };
  });
}

/**
 * Keep valid rows, drop or repair broken ones. Only fail when the payload is not a desk at all.
 * A failed parse must never be used as an excuse to write seed data over stored records.
 */
export function parseDesk(value: unknown): ParseResult {
  if (!isRecord(value)) return { ok: false, reason: "Desk is not an object." };
  if (!Array.isArray(value.developers) || !Array.isArray(value.projects) || !Array.isArray(value.tasks)) {
    return { ok: false, reason: "Desk is missing developers, projects, or tasks." };
  }

  const developers = value.developers.filter(isDeveloper);
  const projects = repairProjects(value.projects.filter(isProject));
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = repairTasks(value.tasks.filter(isTask), projectIds);
  const taskIds = new Set(tasks.map((task) => task.id));
  const comments = (Array.isArray(value.comments) ? value.comments : []).filter(isComment).filter((comment) => {
    return taskIds.has(comment.taskId);
  });

  const desk: DeskState = {
    developers: developers.length > 0 ? ensureSeededRoster(developers) : seedData().developers,
    projects,
    tasks,
    comments,
  };

  return {
    ok: true,
    desk,
    skipped: {
      developers: value.developers.length - developers.length,
      projects: value.projects.length - projects.length,
      tasks: value.tasks.length - tasks.length,
      comments: (Array.isArray(value.comments) ? value.comments.length : 0) - comments.length,
    },
  };
}

export function parseDeskJson(raw: string): ParseResult {
  try {
    return parseDesk(JSON.parse(raw) as unknown);
  } catch {
    return { ok: false, reason: "Desk JSON is not valid." };
  }
}

export function serializeDesk(desk: DeskState): string {
  return JSON.stringify({
    developers: desk.developers,
    projects: desk.projects,
    tasks: desk.tasks,
    comments: desk.comments,
  });
}

/** Writes are allowed after a successful load, including an empty server desk. Never after a failed load. */
export function canPersist(status: LoadStatus): boolean {
  return status === "ok" || status === "empty";
}
