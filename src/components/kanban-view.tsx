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
import { Circle, CircleCheck, CircleDashed, CircleDot, Eye, Flag, Plus, type LucideIcon } from "lucide-react";
import { CreateProjectPrompt } from "@/components/create-project-prompt";
import { TaskDialog } from "@/components/editors";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { formatBoardDue } from "@/lib/dates";
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

const COLUMN_TONE: Record<
  TaskStatus,
  { icon: LucideIcon; pill: string; wash: string; ink: string; edge: string }
> = {
  backlog: {
    icon: CircleDashed,
    pill: "bg-[#6b7280] text-white",
    wash: "bg-[#9ca3af]/10",
    ink: "text-[#9ca3af]",
    edge: "border-[#9ca3af]/20",
  },
  todo: {
    icon: Circle,
    pill: "bg-[#e7e5e4] text-[#1c1917]",
    wash: "bg-[#e7e5e4]/8",
    ink: "text-[#d6d3d1]",
    edge: "border-[#e7e5e4]/15",
  },
  in_progress: {
    icon: CircleDot,
    pill: "bg-[#2563eb] text-white",
    wash: "bg-[#2563eb]/12",
    ink: "text-[#60a5fa]",
    edge: "border-[#2563eb]/25",
  },
  in_review: {
    icon: Eye,
    pill: "bg-[#d97706] text-[#111318]",
    wash: "bg-[#d97706]/12",
    ink: "text-[#fbbf24]",
    edge: "border-[#d97706]/25",
  },
  done: {
    icon: CircleCheck,
    pill: "bg-[#16a34a] text-white",
    wash: "bg-[#16a34a]/12",
    ink: "text-[#4ade80]",
    edge: "border-[#16a34a]/25",
  },
};

const FLAG_CLASS: Record<Priority, string> = {
  high: "fill-[#f97066] text-[#f97066]",
  medium: "fill-[#fbbf24] text-[#fbbf24]",
  low: "fill-[#6b7280] text-[#6b7280]",
};

export function KanbanView() {
  const desk = useDesk();
  const today = useMemo(() => new Date(), []);
  const [projectId, setProjectId] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<TaskStatus | null>(null);
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
    <div data-testid="kanban" className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Kanban"
        lede="Drag a card into another column to change its status. Overdue dates stay red."
        action={
          desk.canWrite ? (
            <Button onClick={() => setCreating("todo")}>
              <Plus />
              New task
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 shrink-0">
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

      {desk.projects.length === 0 ? (
        <CreateProjectPrompt body="Create a project before you add tasks to the board." />
      ) : (
      <>
      {visible.length === 0 ? (
        <EmptyState
          title="No tasks in this view"
          body={
            projectId === "all"
              ? "Add a task and it will land in the column that matches its status."
              : "This project has no tasks yet. Add one, or switch the filter back to all projects."
          }
          action={
            desk.canWrite ? (
              <Button onClick={() => setCreating("todo")}>
                <Plus />
                New task
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={desk.canWrite ? (event: DragStartEvent) => setActiveId(String(event.active.id)) : undefined}
        onDragCancel={desk.canWrite ? () => setActiveId(null) : undefined}
        onDragEnd={desk.canWrite ? onDragEnd : undefined}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1",
            visible.length === 0 && "mt-4 min-h-80",
          )}
        >
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={visible
                .filter((task) => task.status === status)
                .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.due.localeCompare(b.due))}
              today={today}
              onOpen={setEditing}
              onAdd={setCreating}
              canWrite={desk.canWrite}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCardView task={activeTask} today={today} overlay /> : null}
        </DragOverlay>
      </DndContext>
      </>
      )}

      <TaskDialog
        open={creating !== null}
        onOpenChange={(open) => {
          if (!open) setCreating(null);
        }}
        defaultProjectId={projectId === "all" ? undefined : projectId}
        defaultStatus={creating ?? "todo"}
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
  onAdd,
  canWrite,
}: {
  status: TaskStatus;
  tasks: Task[];
  today: Date;
  onOpen: (task: Task) => void;
  onAdd: (status: TaskStatus) => void;
  canWrite: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const tone = COLUMN_TONE[status];
  const Icon = tone.icon;
  const label = TASK_STATUS_LABEL[status];

  return (
    <section
      className={cn(
        "flex h-full w-[17.25rem] shrink-0 flex-col rounded-xl border px-2 pt-2 pb-1.5",
        tone.wash,
        tone.edge,
        isOver && "ring-1 ring-white/25",
      )}
      data-testid={`column-${status}`}
    >
      <header className="mb-2 px-0.5">
        <h2
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold",
            tone.pill,
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          <span className="tabular-nums opacity-80">{tasks.length}</span>
        </h2>
      </header>
      <div ref={setNodeRef} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-0.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} onOpen={onOpen} canWrite={canWrite} />
          ))}
        </div>
        {canWrite ? (
          <button
            type="button"
            className={cn(
              "mt-1 flex w-full shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium hover:bg-white/5",
              tone.ink,
            )}
            data-testid={`add-task-${status}`}
            onClick={() => onAdd(status)}
          >
            <Plus className="size-3.5" aria-hidden />
            Add task
          </button>
        ) : null}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  today,
  onOpen,
  canWrite,
}: {
  task: Task;
  today: Date;
  onOpen: (task: Task) => void;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canWrite });
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

function assigneeInitial(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
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
  const assignee = desk.developerById.get(task.assigneeId);
  const dueLabel = formatBoardDue(task.due, today);

  return (
    <article
      data-testid={overlay ? undefined : "kanban-card"}
      data-task-id={task.id}
      data-overdue={overdue ? "true" : "false"}
      className={cn(
        "rounded-lg border border-white/8 bg-[#14161c] px-2.5 py-2 text-left shadow-xs",
        desk.canWrite ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        overlay && "shadow-lg",
      )}
      {...props}
    >
      <h3 className="text-[13px] leading-snug font-medium">{task.title}</h3>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-medium text-foreground"
          title={assignee?.name ?? "Unassigned"}
        >
          {assigneeInitial(assignee?.name)}
        </span>
        <span
          className={cn(
            "text-[11px]",
            overdue && "font-medium text-[#f97066]",
            !overdue && task.status === "done" && "text-[#4ade80]",
            !overdue && task.status !== "done" && "text-muted-foreground",
          )}
        >
          {dueLabel}
        </span>
        <Flag
          className={cn("ml-auto size-3.5 shrink-0", FLAG_CLASS[task.priority])}
          aria-label={`${PRIORITY_LABEL[task.priority]} priority`}
        />
      </div>
    </article>
  );
}
