"use client";

import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PriorityMark, TaskStatusBadge } from "@/components/badges";
import { CreateProjectPrompt } from "@/components/create-project-prompt";
import { TaskDialog } from "@/components/editors";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect, PersonSelect, SearchField } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShort } from "@/lib/dates";
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/labels";
import { isTaskOverdue } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { Priority, Task, TaskStatus } from "@/lib/types";
import { cn } from "cn";

type SortKey = "title" | "project" | "assignee" | "status" | "priority" | "start" | "due";

const statusRank: Record<TaskStatus, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  in_review: 3,
  done: 4,
};

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function TaskTable({
  projectId,
  heading = "Tasks",
  lede = "Sort any column. Filter by project, person, status, or priority. Change a status from its row, or open a task to edit the rest.",
}: {
  projectId?: string;
  heading?: string;
  lede?: string;
}) {
  const desk = useDesk();
  const today = useMemo(() => new Date(), []);
  const [filterProject, setFilterProject] = useState(projectId ?? "all");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const statusMenuOpen = useRef(false);
  const blockRowOpen = useRef(false);

  const lockedProject = projectId ?? (filterProject === "all" ? undefined : filterProject);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = desk.tasks.filter((task) => {
      if (projectId && task.projectId !== projectId) return false;
      if (!projectId && filterProject !== "all" && task.projectId !== filterProject) return false;
      if (assignee !== "all" && task.assigneeId !== assignee) return false;
      if (status !== "all" && task.status !== status) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (needle) {
        const projectName = desk.projectById.get(task.projectId)?.name ?? "";
        if (!task.title.toLowerCase().includes(needle) && !projectName.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    const value = (task: Task) => {
      switch (sortKey) {
        case "title":
          return task.title.toLowerCase();
        case "project":
          return desk.projectById.get(task.projectId)?.name ?? "";
        case "assignee":
          return desk.developerById.get(task.assigneeId)?.name ?? "";
        case "status":
          return statusRank[task.status];
        case "priority":
          return priorityRank[task.priority];
        case "start":
          return task.start;
        case "due":
          return task.due;
      }
    };

    return filtered.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const compared = left < right ? -1 : left > right ? 1 : a.title.localeCompare(b.title);
      return sortDir === "asc" ? compared : -compared;
    });
  }, [
    assignee,
    desk.developerById,
    desk.projectById,
    desk.tasks,
    filterProject,
    priority,
    projectId,
    query,
    sortDir,
    sortKey,
    status,
  ]);

  function noteStatusMenu(open: boolean) {
    statusMenuOpen.current = open;
    blockRowOpen.current = true;
    if (!open) {
      window.setTimeout(() => {
        if (!statusMenuOpen.current) blockRowOpen.current = false;
      }, 250);
    }
  }

  function changeStatus(task: Task, status: TaskStatus) {
    if (status === task.status) return;
    const result = desk.updateTask(task.id, { status });
    if (!result.ok) toast.error(result.reason);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const commentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comment of desk.comments) {
      counts.set(comment.taskId, (counts.get(comment.taskId) ?? 0) + 1);
    }
    return counts;
  }, [desk.comments]);

  const projectTasks = projectId ? desk.tasks.filter((task) => task.projectId === projectId) : desk.tasks;
  const filtersActive =
    query.trim().length > 0 ||
    assignee !== "all" ||
    status !== "all" ||
    priority !== "all" ||
    (!projectId && filterProject !== "all");

  return (
    <div data-testid="task-list">
      <PageHeader
        title={heading}
        lede={lede}
        action={
          desk.canWrite ? (
            <Button onClick={() => setCreating(true)} data-testid="new-task">
              <Plus />
              New task
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Task or project"
          testId="task-search"
        />
        {projectId ? null : (
          <LabeledSelect
            label="Project"
            value={filterProject}
            onValueChange={setFilterProject}
            testId="filter-project"
            options={[
              { value: "all", label: "All projects" },
              ...desk.projects.map((project) => ({ value: project.id, label: project.name })),
            ]}
          />
        )}
        <PersonSelect
          label="Assignee"
          value={assignee}
          onValueChange={setAssignee}
          developers={desk.developers}
          allowAll
          full={false}
          testId="filter-assignee"
        />
        <LabeledSelect
          label="Status"
          value={status}
          onValueChange={setStatus}
          testId="filter-status"
          options={[
            { value: "all", label: "Any status" },
            ...TASK_STATUSES.map((item) => ({ value: item, label: TASK_STATUS_LABEL[item] })),
          ]}
        />
        <LabeledSelect
          label="Priority"
          value={priority}
          onValueChange={setPriority}
          testId="filter-priority"
          options={[
            { value: "all", label: "Any priority" },
            ...PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABEL[item] })),
          ]}
        />
        {filtersActive ? (
          <Button
            variant="outline"
            className="self-end"
            onClick={() => {
              setQuery("");
              setAssignee("all");
              setStatus("all");
              setPriority("all");
              if (!projectId) setFilterProject("all");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {!projectId && desk.projects.length === 0 ? (
        <CreateProjectPrompt body="Create a project, then add the tasks that belong to it." />
      ) : rows.length === 0 ? (
        <EmptyState
          title={projectTasks.length === 0 ? "No tasks yet" : "Nothing matches these filters"}
          body={
            projectTasks.length === 0
              ? "Add the first task when you know who is doing it and when it is due."
              : "Clear a filter, or add a task that fits what you are looking for."
          }
          action={
            filtersActive ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setAssignee("all");
                  setStatus("all");
                  setPriority("all");
                  if (!projectId) setFilterProject("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              desk.canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New task
                </Button>
              ) : undefined
            )
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Task" sortKey="title" active={sortKey} dir={sortDir} onSort={toggleSort} />
                {projectId ? null : (
                  <SortHead label="Project" sortKey="project" active={sortKey} dir={sortDir} onSort={toggleSort} />
                )}
                <SortHead label="Assignee" sortKey="assignee" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Status" sortKey="status" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Priority" sortKey="priority" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Start" sortKey="start" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Due" sortKey="due" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <TableHead className="text-right">Comments</TableHead>
                <TableHead>Predecessor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((task) => {
                const overdue = isTaskOverdue(task, today);
                const assigneePerson = desk.developerById.get(task.assigneeId);
                const predecessor = task.predecessorTaskId
                  ? desk.tasks.find((item) => item.id === task.predecessorTaskId)
                  : null;
                return (
                  <TableRow
                    key={task.id}
                    data-testid="task-row"
                    data-task-id={task.id}
                    data-overdue={overdue ? "true" : "false"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (blockRowOpen.current) return;
                      setEditing(task);
                    }}
                  >
                    <TableCell className="max-w-64 font-medium whitespace-normal">{task.title}</TableCell>
                    {projectId ? null : (
                      <TableCell>{desk.projectById.get(task.projectId)?.name}</TableCell>
                    )}
                    <TableCell>
                      <span className="block" title={assigneePerson?.email}>
                        {assigneePerson?.name ?? "Unassigned"}
                      </span>
                      <span className="text-xs text-muted-foreground">{assigneePerson?.department}</span>
                    </TableCell>
                    <TableCell
                      className="min-w-36 cursor-default"
                      data-testid="task-status-cell"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {desk.canWrite ? (
                        <TaskStatusSelect
                          task={task}
                          onOpenChange={noteStatusMenu}
                          onChange={(status) => changeStatus(task, status)}
                        />
                      ) : (
                        <TaskStatusBadge status={task.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      <PriorityMark priority={task.priority} />
                    </TableCell>
                    <TableCell className="tabular-nums">{formatShort(task.start)}</TableCell>
                    <TableCell className={cn("tabular-nums", overdue && "font-medium text-[#f97066]")}>
                      {formatShort(task.due)}
                      {overdue ? " · Overdue" : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" data-testid="task-comment-count">
                      {commentCounts.get(task.id) ?? 0}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {predecessor?.title ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDialog
        open={creating}
        onOpenChange={setCreating}
        defaultProjectId={lockedProject}
      />
      <TaskDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} task={editing} />
    </div>
  );
}

const STATUS_OPTIONS = TASK_STATUSES.map((item) => ({
  value: item,
  label: TASK_STATUS_LABEL[item],
}));

function TaskStatusSelect({
  task,
  onChange,
  onOpenChange,
}: {
  task: Task;
  onChange: (status: TaskStatus) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Select
      value={task.status}
      items={STATUS_OPTIONS}
      onOpenChange={onOpenChange}
      onValueChange={(next) => {
        if (!next || next === task.status) return;
        if ((TASK_STATUSES as readonly string[]).includes(next)) onChange(next as TaskStatus);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Status for ${task.title}`}
        data-testid="task-status"
        data-status={task.status}
        className="h-7 w-full min-w-28 justify-between border-border bg-background px-1.5 hover:bg-muted/60"
      >
        <TaskStatusBadge status={task.status} />
      </SelectTrigger>
      <SelectContent align="start" className="min-w-36">
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const mark = active === sortKey ? (dir === "asc" ? "↑" : "↓") : "";
  return (
    <TableHead>
      <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(sortKey)}>
        {label}
        <span className="w-3 text-muted-foreground">{mark}</span>
      </button>
    </TableHead>
  );
}
