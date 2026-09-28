"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PriorityMark, TaskStatusBadge } from "@/components/badges";
import { TaskDialog } from "@/components/editors";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect, PersonSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
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
  lede = "Sort any column. Filter by project, person, status, or priority, then open a row to edit it.",
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
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const lockedProject = projectId ?? (filterProject === "all" ? undefined : filterProject);

  const rows = useMemo(() => {
    const filtered = desk.tasks.filter((task) => {
      if (projectId && task.projectId !== projectId) return false;
      if (!projectId && filterProject !== "all" && task.projectId !== filterProject) return false;
      if (assignee !== "all" && task.assigneeId !== assignee) return false;
      if (status !== "all" && task.status !== status) return false;
      if (priority !== "all" && task.priority !== priority) return false;
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
    sortDir,
    sortKey,
    status,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const projectTasks = projectId ? desk.tasks.filter((task) => task.projectId === projectId) : desk.tasks;
  const filtersActive = assignee !== "all" || status !== "all" || priority !== "all" || (!projectId && filterProject !== "all");

  return (
    <div data-testid="task-list">
      <PageHeader
        title={heading}
        lede={lede}
        action={
          <Button onClick={() => setCreating(true)} data-testid="new-task">
            <Plus />
            New task
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
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
      </div>

      {rows.length === 0 ? (
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
                  setAssignee("all");
                  setStatus("all");
                  setPriority("all");
                  if (!projectId) setFilterProject("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New task
              </Button>
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
                    onClick={() => setEditing(task)}
                  >
                    <TableCell className="max-w-64 font-medium whitespace-normal">{task.title}</TableCell>
                    {projectId ? null : (
                      <TableCell>{desk.projectById.get(task.projectId)?.name}</TableCell>
                    )}
                    <TableCell>
                      <span className="block" title={assigneePerson?.email}>
                        {assigneePerson?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{assigneePerson?.department}</span>
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityMark priority={task.priority} />
                    </TableCell>
                    <TableCell className="tabular-nums">{formatShort(task.start)}</TableCell>
                    <TableCell className={cn("tabular-nums", overdue && "font-medium text-orange-800")}>
                      {formatShort(task.due)}
                      {overdue ? " · Overdue" : ""}
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
