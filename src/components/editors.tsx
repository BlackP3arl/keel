"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DateRangeField } from "@/components/date-range-field";
import { AssigneeSearch, LabeledSelect, PersonSelect, PredecessorSelect } from "@/components/pickers";
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
import { addDays, formatISODate, isISODate, startOfDay } from "@/lib/dates";
import { PRIORITIES, PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/labels";
import { wouldCreateCycle } from "@/lib/links";
import { useDesk } from "@/lib/store";
import type { Developer, Priority, Project, ProjectStatus, Task, TaskStatus } from "@/lib/types";

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

function ownerAssignee(projects: Project[], developers: Developer[], projectId: string): string {
  const ownerId = projects.find((project) => project.id === projectId)?.ownerId ?? "";
  return developers.some((person) => person.id === ownerId) ? ownerId : "";
}

/** Start on the latest task's due date. No due date on that task means today. */
function defaultStartForProject(tasks: Task[], projectId: string, today: string): string {
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    const task = tasks[index];
    if (task.projectId !== projectId) continue;
    return isISODate(task.due) ? task.due : today;
  }
  return today;
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
          if (!desk.canWrite) return;
          save();
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required disabled={!desk.canWrite} />
        </Field>
        <Field label="Summary">
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            className="normal-case"
            disabled={!desk.canWrite}
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
          disabled={!desk.canWrite}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} required disabled={!desk.canWrite} />
          </Field>
          <Field label="Due">
            <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} required disabled={!desk.canWrite} />
          </Field>
        </div>
        <PersonSelect
          label="Owner"
          value={ownerId}
          onValueChange={setOwnerId}
          developers={desk.developers}
          testId="project-owner"
          disabled={!desk.canWrite}
        />
        <PredecessorSelect
          label="Predecessor project"
          value={predecessorProjectId}
          onValueChange={setPredecessorProjectId}
          options={options}
          hint="Projects that would loop back to this one are hidden."
          testId="project-predecessor"
          disabled={!desk.canWrite}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {project && desk.canWrite ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {desk.canWrite ? "Cancel" : "Close"}
            </Button>
            {desk.canWrite ? <Button type="submit">{project ? "Save" : "Create project"}</Button> : null}
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
  defaultStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,80rem)] overflow-y-auto sm:max-w-lg"
        initialFocus={
          task
            ? undefined
            : () => document.querySelector<HTMLElement>("[data-testid='task-title']")
        }
      >
        {open ? (
          task ? (
            <TaskForm task={task} onClose={() => onOpenChange(false)} />
          ) : (
            <NewTaskForm
              defaultProjectId={defaultProjectId}
              defaultStatus={defaultStatus}
              onClose={() => onOpenChange(false)}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NewTaskForm({
  defaultProjectId,
  defaultStatus,
  onClose,
}: {
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  onClose: () => void;
}) {
  const desk = useDesk();
  const today = formatISODate(startOfDay(new Date()));
  const initialProjectId = defaultProjectId ?? desk.projects[0]?.id ?? "";
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [assigneeId, setAssigneeId] = useState(() => ownerAssignee(desk.projects, desk.developers, initialProjectId));
  const [status, setStatus] = useState<TaskStatus>(defaultStatus ?? "todo");
  const [priority, setPriority] = useState<Priority>("medium");
  const [start, setStart] = useState(() => defaultStartForProject(desk.tasks, initialProjectId, today));
  const [due, setDue] = useState("");
  const [duration, setDuration] = useState("");
  const [predecessorTaskId, setPredecessorTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const predecessorChoices = taskOptions(desk.tasks, projectId, null);
  const projectName = desk.projects.find((project) => project.id === projectId)?.name ?? "";

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setAssigneeId(ownerAssignee(desk.projects, desk.developers, nextProjectId));
    setStart(defaultStartForProject(desk.tasks, nextProjectId, today));
    setDue("");
    setDuration("");
    setPredecessorTaskId(null);
  }

  function save() {
    const result = desk.createTask({
      title,
      projectId,
      assigneeId,
      status,
      priority,
      start,
      due,
      predecessorTaskId,
    });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    toast("Task added.");
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New task</DialogTitle>
        <DialogDescription>
          The assignee starts as this project’s owner. A predecessor has to be another task on the same project, and it cannot loop.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3"
        data-testid="new-task-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div data-field="project">
          <LabeledSelect
            label="Project"
            value={projectId}
            onValueChange={changeProject}
            options={desk.projects.map((item) => ({ value: item.id, label: item.name }))}
            testId="task-project"
            full
          />
          <p className="sr-only" data-testid="task-project-name">
            {projectName}
          </p>
        </div>
        <div data-field="title">
          <Field label="Title">
            <Input
              ref={titleRef}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              data-testid="task-title"
            />
          </Field>
        </div>
        <div data-field="dates">
          <DateRangeField
            key={projectId}
            start={start}
            due={due}
            duration={duration}
            onChange={(next) => {
              setStart(next.start);
              setDue(next.due);
              setDuration(next.duration);
            }}
          />
        </div>
        <AssigneeSearch value={assigneeId} onValueChange={setAssigneeId} developers={desk.developers} />
        <div data-field="status">
          <LabeledSelect
            label="Status"
            value={status}
            onValueChange={(next) => setStatus(next as TaskStatus)}
            options={TASK_STATUSES.map((item) => ({ value: item, label: TASK_STATUS_LABEL[item] }))}
            testId="task-status"
            full
          />
        </div>
        <div data-field="priority">
          <LabeledSelect
            label="Priority"
            value={priority}
            onValueChange={(next) => setPriority(next as Priority)}
            options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABEL[item] }))}
            testId="task-priority"
            full
          />
        </div>
        <div data-field="predecessor">
          <PredecessorSelect
            label="Predecessor task"
            value={predecessorTaskId}
            onValueChange={setPredecessorTaskId}
            options={predecessorChoices}
            hint="Tasks that would loop back to this one are hidden."
            testId="task-predecessor"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="task-save">
            Create task
          </Button>
        </DialogFooter>
      </form>
    </>
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
      {task ? <TaskComments task={task} /> : null}
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!desk.canWrite) return;
          save();
        }}
      >
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required data-testid="task-title" disabled={!desk.canWrite} />
        </Field>
        <LabeledSelect
          label="Project"
          value={projectId}
          onValueChange={changeProject}
          options={desk.projects.map((item) => ({ value: item.id, label: item.name }))}
          testId="task-project"
          full
          disabled={!desk.canWrite}
        />
        <PersonSelect
          label="Assignee"
          value={assigneeId}
          onValueChange={setAssigneeId}
          developers={desk.developers}
          testId="task-assignee"
          disabled={!desk.canWrite}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledSelect
            label="Status"
            value={status}
            onValueChange={(next) => setStatus(next as TaskStatus)}
            options={TASK_STATUSES.map((item) => ({ value: item, label: TASK_STATUS_LABEL[item] }))}
            disabled={!desk.canWrite}
          />
          <LabeledSelect
            label="Priority"
            value={priority}
            onValueChange={(next) => setPriority(next as Priority)}
            options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABEL[item] }))}
            disabled={!desk.canWrite}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} required disabled={!desk.canWrite} />
          </Field>
          <Field label="Due">
            <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} required data-testid="task-due" disabled={!desk.canWrite} />
          </Field>
        </div>
        <PredecessorSelect
          label="Predecessor task"
          value={predecessorTaskId}
          onValueChange={setPredecessorTaskId}
          options={predecessorChoices}
          hint="Tasks that would loop back to this one are hidden."
          testId="task-predecessor"
          disabled={!desk.canWrite}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {task && desk.canWrite ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {desk.canWrite ? "Cancel" : "Close"}
            </Button>
            {desk.canWrite ? (
              <Button type="submit" data-testid="task-save">
                {task ? "Save" : "Create task"}
              </Button>
            ) : null}
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

function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TaskComments({ task }: { task: Task }) {
  const desk = useDesk();
  const [body, setBody] = useState("");
  const [authorId, setAuthorId] = useState(
    desk.developers.some((person) => person.id === task.assigneeId) ? task.assigneeId : (desk.developers[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);

  const thread = desk.comments
    .filter((comment) => comment.taskId === task.id)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));

  function add() {
    const result = desk.addComment({ taskId: task.id, body, authorId });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setBody("");
    setError(null);
    toast("Comment added.");
  }

  return (
    <section className="grid gap-3 border-b pb-3" data-testid="task-comments">
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Comments</h3>
      {thread.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="comment-empty">
          There are no comments yet.
        </p>
      ) : (
        <ol className="grid gap-2" data-testid="comment-thread">
          {thread.map((comment) => {
            const author = desk.developerById.get(comment.authorId);
            return (
              <li key={comment.id} className="rounded-md border bg-background px-2.5 py-2" data-testid="task-comment">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{author?.name ?? "Unknown"}</span>
                    {author ? <span> · {author.department}</span> : null}
                    <span> · {formatCommentTime(comment.createdAt)}</span>
                  </p>
                  {desk.canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      data-testid="comment-delete"
                      onClick={() => {
                        desk.deleteComment(comment.id);
                        toast("Comment deleted.");
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      {desk.canWrite ? (
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <PersonSelect
          label="Author"
          value={authorId}
          onValueChange={setAuthorId}
          developers={desk.developers}
          testId="comment-author"
        />
        <Field label="Comment">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder="Add a note for this task"
            data-testid="comment-body"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" data-testid="comment-add">
            Add comment
          </Button>
        </div>
      </form>
      ) : null}
    </section>
  );
}
