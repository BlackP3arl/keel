import { daysBetween, isPastDue, parseISODate, startOfDay } from "@/lib/dates";
import type { Health, LoadLevel, Project, Task } from "@/lib/types";

/** Finished work this far behind elapsed schedule time is off track. */
export const SCHEDULE_SLIP = 0.2;

export function progressRatio(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === "done").length;
  return done / tasks.length;
}

export function projectHealth(project: Project, tasks: Task[], today: Date): Health {
  if (project.status === "on_hold") return "on_hold";

  const allDone = tasks.length > 0 && tasks.every((task) => task.status === "done");
  if (project.status === "done" || allDone) return "done";

  const now = startOfDay(today);
  if (isPastDue(project.due, now)) return "off_track";

  const start = parseISODate(project.start);
  const due = parseISODate(project.due);
  const span = daysBetween(start, due);
  const elapsed = daysBetween(start, now);
  const expected = span <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / span));
  if (progressRatio(tasks) + SCHEDULE_SLIP < expected) return "off_track";

  return "on_track";
}

/** Done projects with tasks read as 100%. Empty projects stay at 0. */
export function shownProgress(tasks: Task[], health: Health): number {
  if (tasks.length === 0) return 0;
  if (health === "done") return 1;
  return progressRatio(tasks);
}

export function isTaskOverdue(task: Task, today: Date): boolean {
  if (task.status === "done") return false;
  return isPastDue(task.due, today);
}

export function loadLevel(openCount: number, overdueCount: number): LoadLevel {
  if (openCount >= 5 || overdueCount >= 2) return "overloaded";
  if (openCount >= 3 || overdueCount >= 1) return "busy";
  return "comfortable";
}

export function healthReason(project: Project, tasks: Task[], today: Date, health: Health): string {
  if (health === "on_hold") {
    return "On hold. A past due date does not mark it late while work is paused.";
  }
  if (health === "done") {
    return project.status === "done" ? "Marked done." : "Every task is done.";
  }

  const now = startOfDay(today);
  if (isPastDue(project.due, now)) return "The due date has passed and work is still open.";

  const start = parseISODate(project.start);
  const due = parseISODate(project.due);
  const span = daysBetween(start, due);
  const elapsed = daysBetween(start, now);
  const expected = span <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / span));
  const done = Math.round(progressRatio(tasks) * 100);
  const schedule = Math.round(expected * 100);

  if (health === "off_track") {
    return `${done}% of tasks are done and about ${schedule}% of the schedule has elapsed.`;
  }
  return `${done}% of tasks are done, in line with ${schedule}% of the schedule elapsed.`;
}
