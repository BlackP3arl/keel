import type { Department, Health, LoadLevel, Priority, ProjectStatus, TaskStatus } from "@/lib/types";

/** Same order as the IT staff list. */
export const DEPARTMENTS: Department[] = [
  "Cloud & Security",
  "Data Services",
  "Software Engineering",
  "IT",
];

export const HEALTH_LABEL: Record<Health, string> = {
  on_track: "On track",
  off_track: "Off track",
  on_hold: "On hold",
  done: "Done",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  done: "Done",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export const LOAD_LABEL: Record<LoadLevel, string> = {
  comfortable: "Comfortable",
  busy: "Busy",
  overloaded: "Overloaded",
};

export const HEALTH_RANK: Record<Health, number> = {
  off_track: 0,
  on_track: 1,
  on_hold: 2,
  done: 3,
};
