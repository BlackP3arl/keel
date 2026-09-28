"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PersonSelect, PredecessorSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/pickers";
import { addDays, formatISODate, startOfDay } from "@/lib/dates";
import { PRIORITIES, PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/labels";
import { wouldCreateCycle } from "@/lib/links";
import { useDesk } from "@/lib/store";
import type { Priority, Project, ProjectStatus, Task, TaskStatus } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </div>
  );
}

function projectOptions(
  projects: Project[],
  currentId: string | null,
  predecessorId: string | null,
) {
  return projects
    .filter((project) => project.id !== currentId)
    .filter((project) => {
      if (!currentId) return true;
      return !wouldCreateCycle(
        projects.map((item) => ({
          id: item.id,
          predecessorId: item.id === currentId ? predecessorId : item.predecessorProjectId,
        })),
        currentId,
        project.id,
      );
    })
    .map((project) => ({ value: project.id, label: project.name }));
}

function taskOptions(tasks: Task[], projectId: string, currentId: string | null) {
  const same = tasks.filter((item) => item.projectId === projectId);
  return same
    .filter((item) => item.id !== currentId)
    .filter((item) => {
      if (!currentId) return true;
      return !wouldCreateCycle(
        same.map((task) => ({ id: task.id, predecessorId: task.predecessorTaskId })),
        currentId,
        item.id,
      );
    })
    .map((item) => ({ value: item.id, label: item.title }));
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <ProjectForm
            project={project ?? null}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const desk = useDesk();
  const today = formatISODate(startOfDay(new Date()));
  const [name, setName] = useState(project?.name ?? "");
  const [summary, setSummary] = useState(project?.summary ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [start, setStart] = useState(project?.start ?? today);
  const [due, setDue] = useState(project?.due ?? formatISODate(addDays(new Date(), 45)));
  const [ownerId, setOwnerId] = useState(project?.ownerId ?? desk.developers[0]?.id ?? "");
  const [predecessorProjectId, setPredecessorProjectId] = useState<string | null>(
    project?.predecessorProjectId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const options = projectOptions(desk.projects, project?.id ?? null, predecessorProjectId);

  function save() {
    const input = {
      name,
      summary,
      status,
      start,
      due,
      ownerId,
      predecessorProjectId,
    };
    const result = project
      ? desk.updateProject(project.id, input)
      : desk.createProject(input);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    toast(project ? "Project updated." : "Project added.");
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        <DialogDescription>
          The owner is anyone already on the roster, in any department. Active, on hold, and done are set here. On track and off track are calculated.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Summary">
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            className="normal-case"
          />
        </Field>
        <LabeledSelect
          label="Workflow"
          value={status}
          onValueChange={(next) => setStatus(next as ProjectStatus)}
          options={(["active", "on_hold", "done"] as ProjectStatus[]).map((item) => ({
            value: item,
            label: PROJECT_STATUS_LABEL[item],
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} required />
          </Field>
          <Field label="Due">
            <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} required />
          </Field>
        </div>
        <PersonSelect
          label="Owner"
          value={ownerId}
          onValueChange={setOwnerId}
          developers={desk.developers}
          testId="project-owner"
        />
        <PredecessorSelect
          label="Predecessor project"
          value={predecessorProjectId}
          onValueChange={setPredecessorProjectId}
          options={options}
          hint="Projects that would loop back to this one are hidden."
          testId="project-predecessor"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {project ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{project ? "Save" : "Create project"}</Button>
          </div>
        </DialogFooter>
      </form>
      {project ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${project.name}?`}
          body="Tasks on this project are removed with it. Predecessor links that pointed here are cleared."
          confirmLabel="Delete project"
          onConfirm={() => {
            desk.deleteProject(project.id);
            toast("Project deleted.");
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultProjectId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <TaskForm
            task={task ?? null}
            defaultProjectId={defaultProjectId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  task,
  defaultProjectId,
  onClose,
}: {
  task: Task | null;
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const desk = useDesk();
  const today = formatISODate(startOfDay(new Date()));
  const [title, setTitle] = useState(task?.title ?? "");
  const [projectId, setProjectId] = useState(
    task?.projectId ?? defaultProjectId ?? desk.projects[0]?.id ?? "",
  );
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? desk.developers[0]?.id ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [start, setStart] = useState(task?.start ?? today);
  const [due, setDue] = useState(task?.due ?? formatISODate(addDays(new Date(), 14)));
  const [predecessorTaskId, setPredecessorTaskId] = useState<string | null>(
    task?.predecessorTaskId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const predecessorChoices = taskOptions(desk.tasks, projectId, task?.id ?? null);

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    if (predecessorTaskId) {
      const predecessor = desk.tasks.find((item) => item.id === predecessorTaskId);
      if (!predecessor || predecessor.projectId !== nextProjectId) setPredecessorTaskId(null);
    }
  }

  function save() {
    const input = {
      title,
      projectId,
      assigneeId,
      status,
      priority,
      start,
      due,
      predecessorTaskId,
    };
    const result = task ? desk.updateTask(task.id, input) : desk.createTask(input);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    toast(task ? "Task updated." : "Task added.");
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription>
          Assign anyone on the roster, including Data Services, Cloud & Security, and the IT Director. A predecessor has to be another task on the same project.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required data-testid="task-title" />
        </Field>
        <LabeledSelect
          label="Project"
          value={projectId}
          onValueChange={changeProject}
          options={desk.projects.map((item) => ({ value: item.id, label: item.name }))}
          testId="task-project"
          full
        />
        <PersonSelect
          label="Assignee"
          value={assigneeId}
          onValueChange={setAssigneeId}
          developers={desk.developers}
          testId="task-assignee"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledSelect
            label="Status"
            value={status}
            onValueChange={(next) => setStatus(next as TaskStatus)}
            options={TASK_STATUSES.map((item) => ({ value: item, label: TASK_STATUS_LABEL[item] }))}
          />
          <LabeledSelect
            label="Priority"
            value={priority}
            onValueChange={(next) => setPriority(next as Priority)}
            options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABEL[item] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} required />
          </Field>
          <Field label="Due">
            <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} required data-testid="task-due" />
          </Field>
        </div>
        <PredecessorSelect
          label="Predecessor task"
          value={predecessorTaskId}
          onValueChange={setPredecessorTaskId}
          options={predecessorChoices}
          hint="Tasks that would loop back to this one are hidden."
          testId="task-predecessor"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {task ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="task-save">
              {task ? "Save" : "Create task"}
            </Button>
          </div>
        </DialogFooter>
      </form>
      {task ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this task?"
          body={`“${task.title}” will be removed. Other tasks that depended on it lose that predecessor.`}
          confirmLabel="Delete task"
          onConfirm={() => {
            desk.deleteTask(task.id);
            toast("Task deleted.");
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
