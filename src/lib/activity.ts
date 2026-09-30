import type { Comment, Project, Task } from "@/lib/types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function timeOf(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = DATE_ONLY.test(value) ? Date.parse(`${value}T12:00:00`) : Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function note(times: Map<string, number>, id: string, value: unknown) {
  const next = timeOf(value);
  if (next == null) return;
  const current = times.get(id);
  if (current == null || next > current) times.set(id, next);
}

/**
 * Projects to show the first time the timeline opens.
 * Real edits win: project or task updatedAt, task createdAt, and comment createdAt.
 * When nothing has been tracked yet, the newest start or due date already stored is the activity.
 * One project with activity stays alone. Two or more keep the two most recent.
 */
export function mostRecentProjectIds(projects: Project[], tasks: Task[], comments: Comment[]): string[] {
  const known = new Set(projects.map((project) => project.id));
  const projectOfTask = new Map(tasks.map((task) => [task.id, task.projectId]));
  const real = new Map<string, number>();
  const stored = new Map<string, number>();

  for (const project of projects) {
    note(real, project.id, project.updatedAt);
    note(stored, project.id, project.start);
    note(stored, project.id, project.due);
  }

  for (const task of tasks) {
    if (!known.has(task.projectId)) continue;
    note(real, task.projectId, task.updatedAt);
    note(real, task.projectId, task.createdAt);
    note(stored, task.projectId, task.start);
    note(stored, task.projectId, task.due);
  }

  for (const comment of comments) {
    const projectId = projectOfTask.get(comment.taskId);
    if (!projectId || !known.has(projectId)) continue;
    note(real, projectId, comment.createdAt);
  }

  const names = new Map(projects.map((project) => [project.id, project.name]));
  const pool = real.size > 0 ? real : stored;
  const ranked = [...pool.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return (names.get(left[0]) ?? left[0]).localeCompare(names.get(right[0]) ?? right[0]);
  });

  const count = ranked.length <= 1 ? ranked.length : 2;
  return ranked.slice(0, count).map(([id]) => id);
}
