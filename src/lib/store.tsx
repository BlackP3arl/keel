"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { canPersist, isDepartment, parseDesk, parseDeskJson, type LoadStatus } from "@/lib/desk-parse";
import { wouldCreateCycle } from "@/lib/links";
import { seedData } from "@/lib/seed";
import type { Comment, DeskState, Developer, Project, Task } from "@/lib/types";

export const STORAGE_KEY = "keel.desk.v2";
const SKIP_IMPORT_KEY = "keel.skipLocalImport";

export type MutationResult = { ok: true } | { ok: false; reason: string };

const READ_ONLY_REASON = "Viewers can look at the desk but cannot change it.";

type DeskContextValue = DeskState & {
  ready: boolean;
  loadStatus: LoadStatus;
  loadError: string | null;
  saveError: string | null;
  saving: boolean;
  canWrite: boolean;
  pendingLocalImport: DeskState | null;
  developerById: Map<string, Developer>;
  projectById: Map<string, Project>;
  createProject: (input: Omit<Project, "id">) => MutationResult & { id?: string };
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => MutationResult;
  deleteProject: (id: string) => void;
  createTask: (input: Omit<Task, "id">) => MutationResult & { id?: string };
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => MutationResult;
  deleteTask: (id: string) => void;
  addComment: (input: { taskId: string; body: string; authorId: string }) => MutationResult & { id?: string };
  deleteComment: (id: string) => void;
  createDeveloper: (input: DeveloperInput) => MutationResult & { id?: string };
  updateDeveloper: (id: string, patch: DeveloperInput) => MutationResult;
  deleteDeveloper: (id: string) => MutationResult;
  importLocalDesk: () => MutationResult;
  dismissLocalImport: () => void;
  exportJson: () => string;
  importJson: (raw: string) => MutationResult;
  retrySave: () => void;
};

type DeveloperInput = {
  name: string;
  role: string;
  department: string;
  email: string;
};

type Snapshot = {
  state: DeskState | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  saveError: string | null;
  saving: boolean;
  pendingLocalImport: DeskState | null;
  needsLogin: boolean;
};

const DeskContext = createContext<DeskContextValue | null>(null);

function developerFromInput(input: DeveloperInput, id: string): { person: Developer } | { error: string } {
  const name = input.name.trim();
  if (!name) return { error: "Give the person a name." };
  if (!isDepartment(input.department)) return { error: "Pick a department." };
  const email = input.email.trim();
  if (email && !email.includes("@")) return { error: "Email needs an @." };
  return {
    person: {
      id,
      name,
      role: input.role.trim(),
      department: input.department,
      email,
    },
  };
}

export function readLocalDesk(): DeskState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseDeskJson(raw);
    return parsed.ok ? parsed.desk : null;
  } catch {
    return null;
  }
}

function skippedImportThisSession(): boolean {
  try {
    return sessionStorage.getItem(SKIP_IMPORT_KEY) === "1";
  } catch {
    return false;
  }
}

function markImportSkipped() {
  try {
    sessionStorage.setItem(SKIP_IMPORT_KEY, "1");
  } catch {
    // sessionStorage can be blocked; the prompt may reappear on reload.
  }
}

function fail(reason: string): MutationResult {
  return { ok: false, reason };
}

function editedAt(): string {
  return new Date().toISOString();
}

function stampProjects(projects: Project[], projectIds: string[], updatedAt: string): Project[] {
  const ids = new Set(projectIds);
  return projects.map((project) => (ids.has(project.id) ? { ...project, updatedAt } : project));
}

function datesOk(start: string, due: string): MutationResult | null {
  if (!start || !due) return fail("Start and due dates are required.");
  if (due < start) return fail("The due date has to be on or after the start date.");
  return null;
}

/** Tasks may be saved with a start and no due date. A due date, once set, cannot precede the start. */
function taskDatesOk(start: string, due: string): MutationResult | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return fail("A start date is required.");
  if (!due) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return fail("The due date is not a real date.");
  if (due < start) return fail("The due date has to be on or after the start date.");
  return null;
}

const listeners = new Set<() => void>();

let snapshot: Snapshot = {
  state: null,
  loadStatus: "pending",
  loadError: null,
  saveError: null,
  saving: false,
  pendingLocalImport: null,
  needsLogin: false,
};

let saveSeq = 0;
let loadStarted = false;
let writesAllowed = true;

export function setDeskWritesAllowed(allowed: boolean) {
  writesAllowed = allowed;
}

function denyWrites(): MutationResult | null {
  if (writesAllowed) return null;
  return fail(READ_ONLY_REASON);
}

function notify() {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  notify();
}

async function persist(state: DeskState) {
  if (!canPersist(snapshot.loadStatus)) return;
  const seq = ++saveSeq;
  setSnapshot({ saving: true });
  try {
    const res = await fetch("/api/desk", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (seq !== saveSeq) return;
    if (res.status === 401) {
      setSnapshot({ saving: false, needsLogin: true });
      return;
    }
    if (res.status === 403) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSnapshot({ saving: false, saveError: body?.error ?? READ_ONLY_REASON });
      toast.error(body?.error ?? READ_ONLY_REASON);
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      const reason = body?.error ?? `Save failed (${res.status}).`;
      setSnapshot({ saving: false, saveError: reason, loadStatus: snapshot.loadStatus === "empty" ? "empty" : "ok" });
      toast.error(reason);
      return;
    }
    setSnapshot({ saving: false, saveError: null, loadStatus: "ok" });
  } catch (error) {
    if (seq !== saveSeq) return;
    const reason = error instanceof Error ? error.message : "Save failed.";
    setSnapshot({ saving: false, saveError: reason });
    toast.error(reason);
  }
}

async function loadFromServer() {
  try {
    const res = await fetch("/api/desk");
    if (res.status === 401 || res.status === 403) {
      setSnapshot({ needsLogin: true });
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSnapshot({
        state: seedData(),
        loadStatus: "failed",
        loadError: body?.error ?? `The desk could not be loaded (${res.status}).`,
        pendingLocalImport: null,
      });
      return;
    }
    const payload = (await res.json()) as { empty?: boolean; desk?: unknown };
    if (payload.empty || payload.desk == null) {
      const local = readLocalDesk();
      const offerImport = local !== null && !skippedImportThisSession();
      setSnapshot({
        state: seedData(),
        loadStatus: "empty",
        loadError: null,
        pendingLocalImport: offerImport ? local : null,
      });
      return;
    }
    const parsed = parseDesk(payload.desk);
    if (!parsed.ok) {
      setSnapshot({
        state: seedData(),
        loadStatus: "failed",
        loadError: parsed.reason,
        pendingLocalImport: null,
      });
      return;
    }
    setSnapshot({
      state: parsed.desk,
      loadStatus: "ok",
      loadError: null,
      pendingLocalImport: null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The desk could not be loaded.";
    setSnapshot({
      state: seedData(),
      loadStatus: "failed",
      loadError: reason,
      pendingLocalImport: null,
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return {
    state: null,
    loadStatus: "pending",
    loadError: null,
    saveError: null,
    saving: false,
    pendingLocalImport: null,
    needsLogin: false,
  };
}

function ensureState(): DeskState {
  if (snapshot.state) return snapshot.state;
  const seeded = seedData();
  snapshot = { ...snapshot, state: seeded };
  return seeded;
}

function commit(next: DeskState) {
  snapshot = { ...snapshot, state: next };
  notify();
  void persist(next);
}

function createProject(input: Omit<Project, "id">): MutationResult & { id?: string } {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
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
  const updatedAt = editedAt();
  commit({
    ...state,
    projects: [
      ...state.projects,
      { ...input, id, name, summary: input.summary.trim(), predecessorProjectId: predecessor, updatedAt },
    ],
  });
  return { ok: true, id };
}

function updateProject(id: string, patch: Partial<Omit<Project, "id">>): MutationResult {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
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
    updatedAt: editedAt(),
  };
  if (!next.name) return fail("Give the project a name.");
  const dateError = datesOk(next.start, next.due);
  if (dateError) return dateError;
  if (next.ownerId && !developerIds.has(next.ownerId)) return fail("Pick an owner from the roster.");
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
  if (denyWrites()) return;
  const state = ensureState();
  commit({
    ...state,
    projects: state.projects
      .filter((project) => project.id !== id)
      .map((project) =>
        project.predecessorProjectId === id ? { ...project, predecessorProjectId: null } : project,
      ),
    tasks: state.tasks.filter((item) => item.projectId !== id),
    comments: state.comments.filter((comment) => {
      const task = state.tasks.find((item) => item.id === comment.taskId);
      return task !== undefined && task.projectId !== id;
    }),
  });
}

function createTask(input: Omit<Task, "id">): MutationResult & { id?: string } {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
  const developerIds = new Set(state.developers.map((person) => person.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  const title = input.title.trim();
  if (!title) return fail("Give the task a title.");
  if (!projectIds.has(input.projectId)) return fail("Pick a project.");
  if (input.assigneeId && !developerIds.has(input.assigneeId)) return fail("Pick an assignee from the roster.");
  const dateError = taskDatesOk(input.start, input.due);
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
  const updatedAt = editedAt();
  commit({
    ...state,
    projects: stampProjects(state.projects, [input.projectId], updatedAt),
    tasks: [
      ...state.tasks,
      { ...input, id, title, predecessorTaskId: input.predecessorTaskId, createdAt: updatedAt, updatedAt },
    ],
  });
  return { ok: true, id };
}

function updateTask(id: string, patch: Partial<Omit<Task, "id">>): MutationResult {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
  const developerIds = new Set(state.developers.map((person) => person.id));
  const projectIds = new Set(state.projects.map((project) => project.id));
  const current = state.tasks.find((item) => item.id === id);
  if (!current) return fail("That task is no longer on the desk.");
  const updatedAt = editedAt();
  const next: Task = {
    ...current,
    ...patch,
    id,
    title: (patch.title ?? current.title).trim(),
    createdAt: current.createdAt,
    updatedAt,
  };
  if (!next.title) return fail("Give the task a title.");
  if (!projectIds.has(next.projectId)) return fail("Pick a project.");
  if (next.assigneeId && !developerIds.has(next.assigneeId)) return fail("Pick an assignee from the roster.");
  const dateError = taskDatesOk(next.start, next.due);
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
    projects: stampProjects(state.projects, [current.projectId, next.projectId], updatedAt),
    tasks: state.tasks.map((item) => (item.id === id ? next : item)),
  });
  return { ok: true };
}

function deleteTask(id: string) {
  if (denyWrites()) return;
  const state = ensureState();
  const current = state.tasks.find((item) => item.id === id);
  const updatedAt = editedAt();
  commit({
    ...state,
    projects: current ? stampProjects(state.projects, [current.projectId], updatedAt) : state.projects,
    tasks: state.tasks
      .filter((item) => item.id !== id)
      .map((item) => (item.predecessorTaskId === id ? { ...item, predecessorTaskId: null } : item)),
    comments: state.comments.filter((comment) => comment.taskId !== id),
  });
}

function addComment(input: { taskId: string; body: string; authorId: string }): MutationResult & { id?: string } {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
  const body = input.body.trim();
  if (!body) return fail("Write a comment first.");
  if (!state.tasks.some((item) => item.id === input.taskId)) return fail("That task is no longer on the desk.");
  if (!state.developers.some((person) => person.id === input.authorId)) {
    return fail("Pick an author from the roster.");
  }
  const id = crypto.randomUUID();
  const updatedAt = editedAt();
  const comment: Comment = {
    id,
    taskId: input.taskId,
    body,
    createdAt: updatedAt,
    authorId: input.authorId,
  };
  const task = state.tasks.find((item) => item.id === input.taskId);
  commit({
    ...state,
    projects: task ? stampProjects(state.projects, [task.projectId], updatedAt) : state.projects,
    tasks: state.tasks.map((item) => (item.id === input.taskId ? { ...item, updatedAt } : item)),
    comments: [...state.comments, comment],
  });
  return { ok: true, id };
}

function deleteComment(id: string) {
  if (denyWrites()) return;
  const state = ensureState();
  const current = state.comments.find((comment) => comment.id === id);
  const task = current ? state.tasks.find((item) => item.id === current.taskId) : undefined;
  const updatedAt = editedAt();
  commit({
    ...state,
    projects: task ? stampProjects(state.projects, [task.projectId], updatedAt) : state.projects,
    tasks: task
      ? state.tasks.map((item) => (item.id === task.id ? { ...item, updatedAt } : item))
      : state.tasks,
    comments: state.comments.filter((comment) => comment.id !== id),
  });
}

function createDeveloper(input: DeveloperInput): MutationResult & { id?: string } {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
  const id = crypto.randomUUID();
  const parsed = developerFromInput(input, id);
  if ("error" in parsed) return fail(parsed.error);
  commit({ ...state, developers: [...state.developers, parsed.person] });
  return { ok: true, id };
}

function updateDeveloper(id: string, patch: DeveloperInput): MutationResult {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
  if (!state.developers.some((person) => person.id === id)) return fail("That person is no longer on the roster.");
  const parsed = developerFromInput(patch, id);
  if ("error" in parsed) return fail(parsed.error);
  commit({
    ...state,
    developers: state.developers.map((person) => (person.id === id ? parsed.person : person)),
  });
  return { ok: true };
}

function deleteDeveloper(id: string): MutationResult {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const state = ensureState();
  if (!state.developers.some((person) => person.id === id)) return fail("That person is no longer on the roster.");
  if (state.developers.length === 1) return fail("Keep at least one person on the roster.");
  commit({
    ...state,
    developers: state.developers.filter((person) => person.id !== id),
    projects: state.projects.map((project) => (project.ownerId === id ? { ...project, ownerId: "" } : project)),
    tasks: state.tasks.map((task) => (task.assigneeId === id ? { ...task, assigneeId: "" } : task)),
    comments: state.comments.map((comment) => (comment.authorId === id ? { ...comment, authorId: "" } : comment)),
  });
  return { ok: true };
}

function importLocalDesk(): MutationResult {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const local = snapshot.pendingLocalImport;
  if (!local) return fail("There is no local desk to import.");
  const parsed = parseDesk(local);
  if (!parsed.ok) return fail(parsed.reason);
  setSnapshot({ pendingLocalImport: null, loadStatus: "empty" });
  commit(parsed.desk);
  return { ok: true };
}

function dismissLocalImport() {
  markImportSkipped();
  setSnapshot({ pendingLocalImport: null });
}

function exportJson(): string {
  const state = ensureState();
  return `${JSON.stringify(
    {
      developers: state.developers,
      projects: state.projects,
      tasks: state.tasks,
      comments: state.comments,
    },
    null,
    2,
  )}\n`;
}

function importJson(raw: string): MutationResult {
  const blocked = denyWrites();
  if (blocked) return blocked;
  const parsed = parseDeskJson(raw);
  if (!parsed.ok) return fail(parsed.reason);
  if (!canPersist(snapshot.loadStatus)) {
    return fail("The desk did not load, so it will not be overwritten.");
  }
  setSnapshot({ pendingLocalImport: null, loadStatus: snapshot.loadStatus === "failed" ? "failed" : "ok" });
  commit(parsed.desk);
  return { ok: true };
}

function retrySave() {
  const state = snapshot.state;
  if (!state) return;
  void persist(state);
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const router = useRouter();
  const session = useSession();
  const canWrite = session.status !== "authenticated" || session.data?.user?.role === "admin";

  useEffect(() => {
    setDeskWritesAllowed(canWrite);
  }, [canWrite]);

  useEffect(() => {
    if (loadStarted) return;
    loadStarted = true;
    void loadFromServer();
  }, []);

  useEffect(() => {
    if (current.needsLogin) router.replace("/login");
  }, [current.needsLogin, router]);

  const ready = current.loadStatus !== "pending";

  const value = useMemo<DeskContextValue>(() => {
    const state = current.state ?? seedData();
    return {
      ...state,
      ready,
      loadStatus: current.loadStatus,
      loadError: current.loadError,
      saveError: current.saveError,
      saving: current.saving,
      canWrite,
      pendingLocalImport: canWrite ? current.pendingLocalImport : null,
      developerById: new Map(state.developers.map((person) => [person.id, person])),
      projectById: new Map(state.projects.map((project) => [project.id, project])),
      createProject,
      updateProject,
      deleteProject,
      createTask,
      updateTask,
      deleteTask,
      addComment,
      deleteComment,
      createDeveloper,
      updateDeveloper,
      deleteDeveloper,
      importLocalDesk,
      dismissLocalImport,
      exportJson,
      importJson,
      retrySave,
    };
  }, [canWrite, ready, current]);

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const value = useContext(DeskContext);
  if (!value) throw new Error("useDesk must be used inside DeskProvider");
  return value;
}
