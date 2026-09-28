"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { wouldCreateCycle } from "@/lib/links";
import { seedData } from "@/lib/seed";
import type { DeskState, Developer, Project, Task } from "@/lib/types";

export const STORAGE_KEY = "keel.desk.v2";

export type MutationResult = { ok: true } | { ok: false; reason: string };

type DeskContextValue = DeskState & {
  ready: boolean;
  developerById: Map<string, Developer>;
  projectById: Map<string, Project>;
  createProject: (input: Omit<Project, "id">) => MutationResult & { id?: string };
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => MutationResult;
  deleteProject: (id: string) => void;
  createTask: (input: Omit<Task, "id">) => MutationResult & { id?: string };
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => MutationResult;
  deleteTask: (id: string) => void;
  resetDesk: () => void;
};

const DeskContext = createContext<DeskContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDeveloper(value: unknown): value is Developer {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.role === "string" &&
    (value.department === "Software Engineering" ||
      value.department === "Data Services" ||
      value.department === "Cloud & Security" ||
      value.department === "IT") &&
    typeof value.email === "string" &&
    value.email.includes("@")
  );
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.summary === "string" &&
    (value.status === "active" || value.status === "on_hold" || value.status === "done") &&
    typeof value.start === "string" &&
    typeof value.due === "string" &&
    typeof value.ownerId === "string" &&
    (value.predecessorProjectId === null || typeof value.predecessorProjectId === "string")
  );
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const statuses = ["backlog", "todo", "in_progress", "in_review", "done"];
  const priorities = ["low", "medium", "high"];
  return (
    typeof value.id === "string" &&
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

function readStored(): DeskState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (!Array.isArray(parsed.developers) || !Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) {
      return null;
    }
    if (!parsed.developers.every(isDeveloper)) return null;
    if (!parsed.projects.every(isProject)) return null;
    if (!parsed.tasks.every(isTask)) return null;
    if (parsed.developers.length === 0) return null;
    return {
      developers: parsed.developers,
      projects: parsed.projects,
      tasks: parsed.tasks,
    };
  } catch {
    return null;
  }
}

function fail(reason: string): MutationResult {
  return { ok: false, reason };
}

function datesOk(start: string, due: string): MutationResult | null {
  if (!start || !due) return fail("Start and due dates are required.");
  if (due < start) return fail("The due date has to be on or after the start date.");
  return null;
}

const listeners = new Set<() => void>();
let clientState: DeskState | null = null;

function persist(state: DeskState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The desk still works for this session if the browser refuses storage.
  }
}

function ensureClient(): DeskState {
  if (!clientState) clientState = readStored() ?? seedData();
  return clientState;
}

function commit(next: DeskState) {
  clientState = next;
  persist(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DeskState | null {
  return ensureClient();
}

function getServerSnapshot(): DeskState | null {
  return null;
}

function createProject(input: Omit<Project, "id">): MutationResult & { id?: string } {
  const state = ensureClient();
  const developerIds = new Set(state.developers.map((person) => person.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  const name = input.name.trim();
  if (!name) return fail("Give the project a name.");
  const dateError = datesOk(input.start, input.due);
  if (dateError) return dateError;
  if (!developerIds.has(input.ownerId)) return fail("Pick an owner from the roster.");
  const id = crypto.randomUUID();
  const predecessor = input.predecessorProjectId;
  if (
    predecessor &&
    wouldCreateCycle(
      state.projects.map((project) => ({
        id: project.id,
        predecessorId: project.predecessorProjectId,
      })),
      id,
      predecessor,
    )
  ) {
    return fail("That predecessor loops back to this project.");
  }
  if (predecessor && !projectIds.has(predecessor)) return fail("That predecessor is not on the desk.");
  commit({
    ...state,
    projects: [
      ...state.projects,
      { ...input, id, name, summary: input.summary.trim(), predecessorProjectId: predecessor },
    ],
  });
  return { ok: true, id };
}

function updateProject(id: string, patch: Partial<Omit<Project, "id">>): MutationResult {
  const state = ensureClient();
  const developerIds = new Set(state.developers.map((person) => person.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  const current = state.projects.find((project) => project.id === id);
  if (!current) return fail("That project is no longer on the desk.");
  const next: Project = {
    ...current,
    ...patch,
    id,
    name: (patch.name ?? current.name).trim(),
    summary: (patch.summary ?? current.summary).trim(),
  };
  if (!next.name) return fail("Give the project a name.");
  const dateError = datesOk(next.start, next.due);
  if (dateError) return dateError;
  if (!developerIds.has(next.ownerId)) return fail("Pick an owner from the roster.");
  const links = state.projects.map((project) => ({
    id: project.id,
    predecessorId: project.id === id ? next.predecessorProjectId : project.predecessorProjectId,
  }));
  if (wouldCreateCycle(links, id, next.predecessorProjectId)) {
    return fail("That predecessor loops back to this project.");
  }
  if (next.predecessorProjectId && !projectIds.has(next.predecessorProjectId)) {
    return fail("That predecessor is not on the desk.");
  }
  commit({
    ...state,
    projects: state.projects.map((project) => (project.id === id ? next : project)),
  });
  return { ok: true };
}

function deleteProject(id: string) {
  const state = ensureClient();
  commit({
    ...state,
    projects: state.projects
      .filter((project) => project.id !== id)
      .map((project) =>
        project.predecessorProjectId === id ? { ...project, predecessorProjectId: null } : project,
      ),
    tasks: state.tasks.filter((item) => item.projectId !== id),
  });
}

function createTask(input: Omit<Task, "id">): MutationResult & { id?: string } {
  const state = ensureClient();
  const developerIds = new Set(state.developers.map((person) => person.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  const title = input.title.trim();
  if (!title) return fail("Give the task a title.");
  if (!projectIds.has(input.projectId)) return fail("Pick a project.");
  if (!developerIds.has(input.assigneeId)) return fail("Pick an assignee from the roster.");
  const dateError = datesOk(input.start, input.due);
  if (dateError) return dateError;
  const id = crypto.randomUUID();
  const sameProject = state.tasks.filter((item) => item.projectId === input.projectId);
  if (input.predecessorTaskId) {
    const predecessor = state.tasks.find((item) => item.id === input.predecessorTaskId);
    if (!predecessor || predecessor.projectId !== input.projectId) {
      return fail("The predecessor has to be a task on the same project.");
    }
    if (
      wouldCreateCycle(
        sameProject.map((item) => ({ id: item.id, predecessorId: item.predecessorTaskId })),
        id,
        input.predecessorTaskId,
      )
    ) {
      return fail("That predecessor loops back to this task.");
    }
  }
  commit({
    ...state,
    tasks: [...state.tasks, { ...input, id, title, predecessorTaskId: input.predecessorTaskId }],
  });
  return { ok: true, id };
}

function updateTask(id: string, patch: Partial<Omit<Task, "id">>): MutationResult {
  const state = ensureClient();
  const developerIds = new Set(state.developers.map((person) => person.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  const current = state.tasks.find((item) => item.id === id);
  if (!current) return fail("That task is no longer on the desk.");
  const next: Task = {
    ...current,
    ...patch,
    id,
    title: (patch.title ?? current.title).trim(),
  };
  if (!next.title) return fail("Give the task a title.");
  if (!projectIds.has(next.projectId)) return fail("Pick a project.");
  if (!developerIds.has(next.assigneeId)) return fail("Pick an assignee from the roster.");
  const dateError = datesOk(next.start, next.due);
  if (dateError) return dateError;
  if (next.projectId !== current.projectId && next.predecessorTaskId) {
    const predecessor = state.tasks.find((item) => item.id === next.predecessorTaskId);
    if (!predecessor || predecessor.projectId !== next.projectId) next.predecessorTaskId = null;
  }
  if (next.predecessorTaskId) {
    const predecessor = state.tasks.find((item) => item.id === next.predecessorTaskId);
    if (!predecessor || predecessor.projectId !== next.projectId) {
      return fail("The predecessor has to be a task on the same project.");
    }
  }
  const sameProject = state.tasks
    .filter((item) => item.projectId === next.projectId || item.id === id)
    .map((item) => (item.id === id ? next : item))
    .filter((item) => item.projectId === next.projectId);
  if (
    wouldCreateCycle(
      sameProject.map((item) => ({ id: item.id, predecessorId: item.predecessorTaskId })),
      id,
      next.predecessorTaskId,
    )
  ) {
    return fail("That predecessor loops back to this task.");
  }
  commit({
    ...state,
    tasks: state.tasks.map((item) => (item.id === id ? next : item)),
  });
  return { ok: true };
}

function deleteTask(id: string) {
  const state = ensureClient();
  commit({
    ...state,
    tasks: state.tasks
      .filter((item) => item.id !== id)
      .map((item) => (item.predecessorTaskId === id ? { ...item, predecessorTaskId: null } : item)),
  });
}

function resetDesk() {
  commit(seedData());
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = snapshot !== null;

  const value = useMemo<DeskContextValue>(() => {
    const state = snapshot ?? seedData();
    return {
      ...state,
      ready,
      developerById: new Map(state.developers.map((person) => [person.id, person])),
      projectById: new Map(state.projects.map((project) => [project.id, project])),
      createProject,
      updateProject,
      deleteProject,
      createTask,
      updateTask,
      deleteTask,
      resetDesk,
    };
  }, [ready, snapshot]);

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const value = useContext(DeskContext);
  if (!value) throw new Error("useDesk must be used inside DeskProvider");
  return value;
}
