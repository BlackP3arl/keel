"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addDays, daysBetween, formatISODate, parseISODate, startOfDay } from "@/lib/dates";
import { isTaskOverdue, projectHealth } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { Project, Task } from "@/lib/types";
import { cn } from "cn";

/** Existing timeline tones, as close as a per-row Gantt color allows. */
const PROJECT_ON_TRACK = 0x34d399;
const PROJECT_LATE = 0xfb923c;
const PROJECT_HOLD = 0x9ca3af;
const PROJECT_DONE = 0x2dd4bf;
const TASK_ON_TRACK = 0x6b7280;
const TASK_LATE = 0xf97066;
const TASK_DONE = 0x5eead4;

const DAY_MS = 86_400_000;

type CategoryRow = {
  id: string;
  name: string;
  parentId?: string;
  color: number;
};

type SeriesRow = {
  id: string;
  start?: number;
  duration?: number;
  progress: number;
  linkTo?: string[];
};

type GanttModel = {
  categories: CategoryRow[];
  series: SeriesRow[];
};

type DeskSlice = {
  projects: Project[];
  tasks: Task[];
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => { ok: true } | { ok: false; reason: string };
};

function hasSchedule(start: string, due: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  if (due < start) return false;
  const startDate = parseISODate(start);
  const dueDate = parseISODate(due);
  return !Number.isNaN(startDate.getTime()) && !Number.isNaN(dueDate.getTime());
}

/** Inclusive calendar days. A same-day task is one day, not a zero-length milestone. */
function durationDays(start: string, due: string): number {
  return Math.max(1, daysBetween(parseISODate(start), parseISODate(due)) + 1);
}

function msToISO(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getHours() >= 12 ? addDays(startOfDay(date), 1) : startOfDay(date);
  return formatISODate(day);
}

function dueFromStart(start: string, duration: number): string {
  const days = Math.max(1, Math.round(duration));
  return formatISODate(addDays(parseISODate(start), days - 1));
}

function buildModel(projects: Project[], tasks: Task[], selectedIds: string[], today: Date): GanttModel {
  const chosen = new Set(selectedIds);
  const ordered = [...projects]
    .filter((project) => chosen.size === 0 || chosen.has(project.id))
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));

  const categories: CategoryRow[] = [];
  const series: SeriesRow[] = [];
  const onChart = new Set<string>();

  for (const project of ordered) {
    const projectTasks = tasks
      .filter((task) => task.projectId === project.id)
      .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    const health = projectHealth(project, projectTasks, today);
    const projectColor =
      health === "off_track"
        ? PROJECT_LATE
        : health === "on_hold"
          ? PROJECT_HOLD
          : health === "done"
            ? PROJECT_DONE
            : PROJECT_ON_TRACK;

    categories.push({ id: project.id, name: project.name, color: projectColor });
    if (hasSchedule(project.start, project.due)) {
      series.push({
        id: project.id,
        start: parseISODate(project.start).getTime(),
        duration: durationDays(project.start, project.due),
        progress: health === "done" ? 1 : 0,
      });
    }

    for (const task of projectTasks) {
      const overdue = isTaskOverdue(task, today);
      const taskColor = task.status === "done" ? TASK_DONE : overdue ? TASK_LATE : TASK_ON_TRACK;
      categories.push({
        id: task.id,
        name: task.title,
        parentId: project.id,
        color: taskColor,
      });
      if (!hasSchedule(task.start, task.due)) continue;
      onChart.add(task.id);
      series.push({
        id: task.id,
        start: parseISODate(task.start).getTime(),
        duration: durationDays(task.start, task.due),
        progress: task.status === "done" ? 1 : 0,
      });
    }
  }

  const links = new Map<string, string[]>();
  for (const task of tasks) {
    const predecessorId = task.predecessorTaskId;
    if (!predecessorId || !onChart.has(task.id) || !onChart.has(predecessorId)) continue;
    const next = links.get(predecessorId) ?? [];
    next.push(task.id);
    links.set(predecessorId, next);
  }
  for (const row of series) {
    const linkTo = links.get(row.id);
    if (linkTo && linkTo.length > 0) row.linkTo = [...linkTo].sort();
  }

  return { categories, series };
}

function modelKey(model: GanttModel): string {
  const categories = model.categories
    .map((row) => `${row.id}|${row.parentId ?? ""}|${row.name}|${row.color}`)
    .join(";");
  const series = model.series
    .map((row) => `${row.id}|${row.start ?? ""}|${row.duration ?? ""}|${row.progress}|${(row.linkTo ?? []).join(",")}`)
    .join(";");
  return `${categories}#${series}`;
}

export function GanttView() {
  const desk = useDesk();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ root: { dispose: () => void }; chart: GanttChartHandle } | null>(null);
  const deskRef = useRef<DeskSlice>(desk);
  const filterRef = useRef(projectFilter);
  const todayRef = useRef(today);
  const appliedKey = useRef("");
  const pauseApply = useRef(false);

  useEffect(() => {
    deskRef.current = desk;
    filterRef.current = projectFilter;
    todayRef.current = today;
  }, [desk, projectFilter, today]);

  const projectOptions = useMemo(
    () => [...desk.projects].sort((a, b) => a.name.localeCompare(b.name)),
    [desk.projects],
  );

  const selectedProjects = useMemo(() => {
    if (projectFilter.length === 0) return [];
    const chosen = new Set(projectFilter);
    return projectOptions.filter((project) => chosen.has(project.id));
  }, [projectFilter, projectOptions]);

  const filterLabel = selectedProjects.length === 0 ? "All projects" : selectedProjects.map((project) => project.name).join(", ");

  const model = useMemo(
    () => buildModel(desk.projects, desk.tasks, selectedProjects.map((project) => project.id), today),
    [desk.projects, desk.tasks, selectedProjects, today],
  );
  const key = useMemo(() => modelKey(model), [model]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || model.categories.length === 0) return;

    let disposed = false;
    let rootDispose: { dispose: () => void } | undefined;

    (async () => {
      try {
        const am5 = await import("@amcharts/amcharts5");
        const am5xy = await import("@amcharts/amcharts5/xy");
        const am5gantt = await import("@amcharts/amcharts5/gantt");
        const { default: Animated } = await import("@amcharts/amcharts5/themes/Animated");
        const { default: Dark } = await import("@amcharts/amcharts5/themes/Dark");
        if (disposed || !hostRef.current) return;

        const root = am5.Root.new(hostRef.current);
        rootDispose = root;
        root.setThemes([Animated.new(root), Dark.new(root), KeelTheme.from(am5, root)]);

        const chart = root.container.children.push(
          am5gantt.Gantt.new(root, {
            durationUnit: "day",
            excludeWeekends: false,
            editable: true,
            linkNewTasks: false,
            sidebarWidth: 280,
            paddingTop: 4,
            paddingRight: 8,
            paddingBottom: 4,
            paddingLeft: 4,
          }),
        );

        // Gantt draws its plot with the xy module.
        if (!(chart.xyChart instanceof am5xy.XYChart)) {
          throw new Error("Gantt plot did not start.");
        }
        chart.xyChart.plotContainer.set(
          "background",
          am5.Rectangle.new(root, { fill: am5.color(0x111318), fillOpacity: 1 }),
        );

        chart.yAxis.setAll({ minCellHeight: 34, childCellSize: 1, childShift: 18 });
        chart.addButton.hide(0);
        chart.clearButton.hide(0);
        chart.colorPickerButton.hide(0);
        chart.linkButton.hide(0);
        chart.yAxis.xButton.hide(0);
        chart.yAxis.get("renderer").durationSteppers.template.set("forceHidden", true);
        chart.series.columns.template.setAll({
          cursorOverStyle: "grab",
          cornerRadiusTL: 3,
          cornerRadiusTR: 3,
          cornerRadiusBL: 3,
          cornerRadiusBR: 3,
          height: am5.percent(46),
        });

        let timer = 0;
        let armed = false;
        const persist = () => {
          if (disposed) return;
          const savedKey = writeDraggedDates(chart, deskRef.current, filterRef.current, todayRef.current, pauseApply, appliedKey);
          if (savedKey) appliedKey.current = savedKey;
        };
        const arm = () => {
          armed = true;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            if (!armed || disposed) return;
            armed = false;
            persist();
          }, 800);
        };
        chart.series.columns.template.events.on("dragstop", arm);
        chart.series.startGrips.template.events.on("dragstop", arm);
        chart.series.endGrips.template.events.on("dragstop", arm);
        chart.events.on("valueschanged", () => {
          if (armed) arm();
        });

        chartRef.current = { root, chart };
        if (!disposed) setChartReady(true);
      } catch (error) {
        if (!disposed) {
          setChartError(error instanceof Error ? error.message : "The timeline chart could not start.");
        }
      }
    })();

    return () => {
      disposed = true;
      rootDispose?.dispose();
      chartRef.current = null;
      appliedKey.current = "";
      setChartReady(false);
    };
    // Recreate only when the host mounts. Data updates go through the apply effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.categories.length === 0]);

  useEffect(() => {
    const chart = chartRef.current?.chart;
    if (!chart || !chartReady || pauseApply.current) return;
    if (appliedKey.current === key) return;
    appliedKey.current = key;
    chart.yAxis.data.setAll(model.categories);
    chart.series.data.setAll(model.series);
    const fit = () => {
      const min = chart.series.getPrivate("selectionMinX");
      const max = chart.series.getPrivate("selectionMaxX");
      if (min == null || max == null || !(max > min)) return;
      const pad = (max - min) * 0.05;
      chart.xAxis.zoomToValues(min - pad, max + pad);
    };
    const frame = window.setTimeout(fit, 400);
    return () => window.clearTimeout(frame);
  }, [chartReady, key, model]);

  return (
    <div data-testid="gantt" className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <PageHeader
        title="Timeline"
        lede="Projects sit above their tasks. Lines run from a predecessor to the work that follows it. Drag a bar to move its dates. Rust bars are late."
        action={
          <ProjectFilter
            projects={projectOptions}
            selectedIds={selectedProjects.map((project) => project.id)}
            label={filterLabel}
            onToggle={(id, checked) => {
              setProjectFilter((current) => {
                const next = new Set(current);
                if (checked) next.add(id);
                else next.delete(id);
                return projectOptions.filter((project) => next.has(project.id)).map((project) => project.id);
              });
            }}
            onClear={() => setProjectFilter([])}
          />
        }
      />

      {model.categories.length === 0 ? (
        <div data-testid="gantt-empty">
          <EmptyState
            title="No matching projects"
            body={
              selectedProjects.length > 0
                ? "Nothing on the timeline matches this filter."
                : "Projects you add will appear here with their tasks."
            }
            action={
              selectedProjects.length > 0 ? (
                <Button size="sm" variant="outline" onClick={() => setProjectFilter([])}>
                  Show all projects
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend swatch="bg-[#34d399]" label="On track" />
            <Legend swatch="bg-[#fb923c]" label="Late" />
            <Legend swatch="bg-[#9ca3af]" label="On hold" />
            <Legend swatch="bg-[#2dd4bf]" label="Done" />
            <Legend swatch="bg-[#6b7280]" label="Open task" />
            <Legend swatch="bg-[#f97066]" label="Overdue task" />
            <Legend swatch="bg-[#5eead4]" label="Finished task" />
          </div>
          {chartError ? (
            <p className="mb-2 text-sm text-[#f97066]">{chartError}</p>
          ) : null}
          <div
            ref={hostRef}
            data-testid="gantt-chart"
            className="h-[calc(100dvh-14rem)] min-h-[36rem] w-full overflow-hidden rounded-lg border border-border bg-[#111318]"
          />
        </>
      )}
    </div>
  );
}

type GanttChartHandle = import("@amcharts/amcharts5/gantt").Gantt;

function writeDraggedDates(
  chart: GanttChartHandle,
  desk: DeskSlice,
  selectedIds: string[],
  today: Date,
  pauseApply: { current: boolean },
  appliedKey: { current: string },
): string | null {
  const taskById = new Map(desk.tasks.map((task) => [task.id, task]));
  const nextTasks = desk.tasks.map((task) => ({ ...task }));
  const nextById = new Map(nextTasks.map((task) => [task.id, task]));
  let changed = false;

  for (const dataItem of chart.series.dataItems) {
    const id = dataItem.get("id");
    if (!id || !taskById.has(id)) continue;
    const startMs = dataItem.get("openValueX");
    const endMs = dataItem.get("valueX");
    if (startMs == null || endMs == null) continue;
    const start = msToISO(startMs);
    if (!start) continue;
    const span = Math.round((endMs - startMs) / DAY_MS);
    const due = dueFromStart(start, span > 0 ? span : (dataItem.get("duration") ?? 1));
    const current = nextById.get(id);
    if (!current || (current.start === start && current.due === due)) continue;
    current.start = start;
    current.due = due;
    changed = true;
  }

  if (!changed) return null;

  const nextKey = modelKey(buildModel(desk.projects, nextTasks, selectedIds, today));
  pauseApply.current = true;
  appliedKey.current = nextKey;
  try {
    for (const task of nextTasks) {
      const previous = taskById.get(task.id);
      if (!previous || (previous.start === task.start && previous.due === task.due)) continue;
      const result = desk.updateTask(task.id, { start: task.start, due: task.due });
      if (!result.ok) {
        appliedKey.current = "";
        toast.error(result.reason);
        break;
      }
    }
  } finally {
    pauseApply.current = false;
  }
  return appliedKey.current || null;
}

function KeelThemeFromModule(am5: typeof import("@amcharts/amcharts5")) {
  return class KeelTheme extends am5.Theme {
    setupDefaultRules() {
      super.setupDefaultRules();
      const ink = am5.color(0xf3f4f6);
      const canvas = am5.color(0x111318);
      const surface = am5.color(0x1a1c23);
      const accent = am5.color(0x2dd4bf);
      const line = am5.color(0x2e303a);
      this.rule("InterfaceColors").setAll({
        stroke: line,
        fill: surface,
        primaryButton: accent,
        primaryButtonHover: am5.color(0x5eead4),
        primaryButtonDown: am5.color(0x14b8a6),
        primaryButtonActive: accent,
        primaryButtonText: canvas,
        primaryButtonStroke: accent,
        secondaryButton: am5.color(0x22242c),
        secondaryButtonHover: line,
        secondaryButtonDown: line,
        secondaryButtonActive: line,
        secondaryButtonText: ink,
        secondaryButtonStroke: line,
        grid: line,
        background: canvas,
        alternativeBackground: ink,
        text: ink,
        alternativeText: canvas,
        disabled: am5.color(0x6b7280),
        positive: am5.color(0x34d399),
        negative: am5.color(0xf97066),
      });
      this.rule("Label").setAll({ fill: ink, fontSize: 12 });
      this.rule("AxisLabel").setAll({ fill: ink });
      this.rule("EditableLabel").setAll({ fill: ink });
      this.rule("EditableAxisLabel").setAll({ fill: ink });
      this.rule("Grid").setAll({ stroke: line, strokeOpacity: 0.45 });
      this.rule("OrthogonalLine", ["line"]).setAll({
        stroke: am5.color(0x9ca3af),
        strokeOpacity: 1,
        strokeWidth: 1.5,
      });
    }
  };
}

const KeelTheme = {
  from(am5: typeof import("@amcharts/amcharts5"), root: import("@amcharts/amcharts5").Root) {
    const Theme = KeelThemeFromModule(am5);
    return Theme.new(root);
  },
};

function ProjectFilter({
  projects,
  selectedIds,
  label,
  onToggle,
  onClear,
}: {
  projects: Project[];
  selectedIds: string[];
  label: string;
  onToggle: (id: string, checked: boolean) => void;
  onClear: () => void;
}) {
  const selected = new Set(selectedIds);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="project-filter"
        title={label}
        aria-label={`Projects: ${label}`}
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-auto max-w-[min(100vw-2rem,28rem)] whitespace-normal py-1 text-left"
          />
        }
      >
        <span className="text-left whitespace-normal">{label}</span>
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.length === 0 ? (
            <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
          ) : (
            projects.map((project) => (
              <DropdownMenuCheckboxItem
                key={project.id}
                checked={selected.has(project.id)}
                onCheckedChange={(checked) => onToggle(project.id, checked)}
                data-testid={`project-filter-${project.id}`}
              >
                {project.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuGroup>
        {selectedIds.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="project-filter-clear" onClick={onClear}>
              Show all projects
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", swatch)} />
      {label}
    </span>
  );
}
