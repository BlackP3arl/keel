/** Delivery desk records. Assignments store developer ids, never email addresses. */

export type ProjectStatus = "active" | "on_hold" | "done";

export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";

export type Priority = "low" | "medium" | "high";

export type Health = "on_track" | "off_track" | "on_hold" | "done";

export type LoadLevel = "comfortable" | "busy" | "overloaded";

export type Department =
  | "Software Engineering"
  | "Data Services"
  | "Cloud & Security"
  | "IT";

/**
 * Person on the IT roster. `id` is stable and is what projects and tasks store.
 * `email` is kept so a later Google sign-in can match this person without moving work.
 * Designation is stored as `role`. Google sign-in is matched by email, not by this id.
 */
export type Developer = {
  id: string;
  name: string;
  role: string;
  department: Department;
  email: string;
};

export type Project = {
  id: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  start: string;
  due: string;
  predecessorProjectId: string | null;
  ownerId: string;
  /** Set when the project, or a task or comment on it, is created or edited. */
  updatedAt?: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string;
  status: TaskStatus;
  start: string;
  due: string;
  predecessorTaskId: string | null;
  priority: Priority;
  createdAt?: string;
  /** Set when the task is created or edited, including status, dates, assignee, and comments. */
  updatedAt?: string;
};

/** A note on a task. `authorId` is a roster person id, same as task assignees. */
export type Comment = {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  authorId: string;
};

export type DeskState = {
  developers: Developer[];
  projects: Project[];
  tasks: Task[];
  comments: Comment[];
};
