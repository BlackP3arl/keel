"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { PriorityMark } from "@/components/badges";
import { TaskDialog } from "@/components/editors";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { formatShort } from "@/lib/dates";
import { PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/labels";
import { isTaskOverdue } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { Priority, Task, TaskStatus } from "@/lib/types";
import { cn } from "cn";

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) return hits;
  return rectIntersection(args);
};

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function KanbanView() {
  const desk = useDesk();
  const today = useMemo(() => new Date(), []);
  const [projectId, setProjectId] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visible = desk.tasks.filter((task) => projectId === "all" || task.projectId === projectId);
  const activeTask = desk.tasks.find((task) => task.id === activeId) ?? null;

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const overId = event.over?.id;
    if (!overId || !TASK_STATUSES.includes(String(overId) as TaskStatus)) return;
    const status = String(overId) as TaskStatus;
    const task = desk.tasks.find((item) => item.id === String(event.active.id));
    if (!task || task.status === status) return;
    desk.updateTask(task.id, { status });
  }

  return (
    <div data-testid="kanban">
      <PageHeader
        title="Kanban"
        lede="Drag a card into another column to change its status. Rust marks a task past its due date."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New task
          </Button>
        }
      />
      <div className="mb-4">
        <LabeledSelect
          label="Project"
          value={projectId}
          onValueChange={setProjectId}
          testId="kanban-project-filter"
          options={[
            { value: "all", label: "All projects" },
            ...desk.projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No tasks in this view"
          body={
            projectId === "all"
              ? "Add a task and it will land in the column that matches its status."
              : "This project has no tasks yet. Add one, or switch the filter back to all projects."
          }
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New task
            </Button>
          }
        />
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className={cn("flex gap-3 overflow-x-auto pb-2", visible.length === 0 && "mt-4", "md:grid md:grid-cols-5")}>
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={visible
                .filter((task) => task.status === status)
                .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.due.localeCompare(b.due))}
              today={today}
              onOpen={setEditing}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCardView task={activeTask} today={today} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        open={creating}
        onOpenChange={setCreating}
        defaultProjectId={projectId === "all" ? undefined : projectId}
      />
      <TaskDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} task={editing} />
    </div>
  );
}

function Column({
  status,
  tasks,
  today,
  onOpen,
}: {
  status: TaskStatus;
  tasks: Task[];
  today: Date;
  onOpen: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className="flex w-72 shrink-0 flex-col md:w-auto" data-testid={`column-${status}`}>
      <header className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium">{TASK_STATUS_LABEL[status]}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{tasks.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-48 flex-1 flex-col gap-2 rounded-lg bg-muted/70 p-2",
          isOver && "bg-accent",
        )}
      >
        {tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing here</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} today={today} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  today,
  onOpen,
}: {
  task: Task;
  today: Date;
  onOpen: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const origin = useRef<{ x: number; y: number } | null>(null);
  const style = { transform: CSS.Translate.toString(transform) };
  const { onPointerDown, ...rest } = listeners ?? {};

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <TaskCardView
        task={task}
        today={today}
        {...attributes}
        {...rest}
        onPointerDown={(event) => {
          origin.current = { x: event.clientX, y: event.clientY };
          onPointerDown?.(event);
        }}
        onClick={(event) => {
          if (!origin.current) return;
          const dx = Math.abs(event.clientX - origin.current.x);
          const dy = Math.abs(event.clientY - origin.current.y);
          if (dx < 6 && dy < 6) onOpen(task);
        }}
      />
    </div>
  );
}

function TaskCardView({
  task,
  today,
  overlay = false,
  ...props
}: {
  task: Task;
  today: Date;
  overlay?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  const desk = useDesk();
  const overdue = isTaskOverdue(task, today);
  const project = desk.projectById.get(task.projectId);
  const assignee = desk.developerById.get(task.assigneeId);

  return (
    <article
      data-testid={overlay ? undefined : "kanban-card"}
      data-task-id={task.id}
      data-overdue={overdue ? "true" : "false"}
      className={cn(
        "cursor-grab rounded-md border bg-card px-2.5 py-2 text-left shadow-xs active:cursor-grabbing",
        overdue && "border-l-4 border-l-[#f97066] bg-[#f97066]/10",
        overlay && "shadow-md",
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium">{task.title}</h3>
        <PriorityMark priority={task.priority} />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{project?.name}</p>
      <p className={cn("mt-2 text-xs", overdue ? "font-medium text-[#f97066]" : "text-muted-foreground")}>
        <span title={assignee?.email}>{assignee?.name ?? "Unassigned"}</span>
        <span> · {formatShort(task.due)}</span>
        {overdue ? <span> · Overdue</span> : null}
      </p>
      <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority</span>
    </article>
  );
}
