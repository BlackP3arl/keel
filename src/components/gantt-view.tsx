"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
import { addDays, daysBetween, formatISODate, formatShort, parseISODate, startOfDay } from "@/lib/dates";
import { isTaskOverdue, projectHealth } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { Project } from "@/lib/types";
import { cn } from "cn";

const ROW = 36;

type Tone = "track" | "late" | "hold" | "done" | "task" | "task-late" | "task-done";

type Bar = {
  key: string;
  label: string;
  hint: string;
  start: string;
  due: string;
  tone: Tone;
  indent: boolean;
};

function toneClass(tone: Tone) {
  switch (tone) {
    case "track":
      return "bg-[#34d399]";
    case "late":
      return "bg-[#fb923c]";
    case "hold":
      return "bg-[#9ca3af]";
    case "done":
      return "bg-[#2dd4bf]";
    case "task":
      return "bg-[#6b7280]";
    case "task-late":
      return "bg-[#f97066]";
    case "task-done":
      return "bg-[#5eead4]";
  }
}

function linkPath(x1: number, y1: number, x2: number, y2: number) {
  if (x2 >= x1 + 8) {
    const mid = x1 + Math.min(16, (x2 - x1) / 2);
    return `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`;
  }
  const drop = y2 >= y1 ? 14 : -14;
  return `M ${x1} ${y1} H ${x1 + 12} V ${y1 + drop} H ${x2 - 12} V ${y2} H ${x2}`;
}

export function GanttView() {
  const desk = useDesk();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [zoom, setZoom] = useState<"schedule" | "days">("schedule");
  const [narrow, setNarrow] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const labelWidth = narrow ? 136 : 220;
  const px = zoom === "days" ? (narrow ? 14 : 18) : narrow ? 7 : 9;

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

  const bars = useMemo(() => {
    const chosen = new Set(selectedProjects.map((project) => project.id));
    const ordered = [...desk.projects]
      .filter((project) => chosen.size === 0 || chosen.has(project.id))
      .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
    const next: Bar[] = [];
    for (const project of ordered) {
      const tasks = desk.tasks
        .filter((task) => task.projectId === project.id)
        .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
      const health = projectHealth(project, tasks, today);
      const tone: Tone =
        health === "off_track" ? "late" : health === "on_hold" ? "hold" : health === "done" ? "done" : "track";
      next.push({
        key: `project:${project.id}`,
        label: project.name,
        hint: `${project.name}, ${project.start} to ${project.due}`,
        start: project.start,
        due: project.due,
        tone,
        indent: false,
      });
      for (const task of tasks) {
        const overdue = isTaskOverdue(task, today);
        next.push({
          key: `task:${task.id}`,
          label: task.title,
          hint: `${task.title}, ${task.start} to ${task.due}`,
          start: task.start,
          due: task.due,
          tone: task.status === "done" ? "task-done" : overdue ? "task-late" : "task",
          indent: true,
        });
      }
    }
    return next;
  }, [desk.projects, desk.tasks, selectedProjects, today]);

  const range = useMemo(() => {
    let min = today;
    let max = today;
    for (const bar of bars) {
      const start = parseISODate(bar.start);
      const due = parseISODate(bar.due);
      if (start < min) min = start;
      if (due > max) max = due;
    }
    return { start: addDays(min, -3), end: addDays(max, 7) };
  }, [bars, today]);

  const totalDays = Math.max(1, daysBetween(range.start, range.end) + 1);
  const timelineWidth = totalDays * px;
  const { indexByKey, links } = useMemo(() => {
    const index = new Map(bars.map((bar, index) => [bar.key, index]));
    const projectLinks = desk.projects
      .filter((project) => project.predecessorProjectId)
      .map((project) => ({
        from: `project:${project.predecessorProjectId}`,
        to: `project:${project.id}`,
        kind: "project" as const,
      }));
    const taskLinks = desk.tasks
      .filter((task) => task.predecessorTaskId)
      .map((task) => ({
        from: `task:${task.predecessorTaskId}`,
        to: `task:${task.id}`,
        kind: "task" as const,
      }));
    const links = [...projectLinks, ...taskLinks].filter(
      (link) => index.has(link.from) && index.has(link.to),
    );
    return { indexByKey: index, links };
  }, [bars, desk.projects, desk.tasks]);

  const months = useMemo(() => {
    const segments: { label: string; span: number }[] = [];
    let index = 0;
    while (index < totalDays) {
      const date = addDays(range.start, index);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const span = Math.min(lastDay - date.getDate() + 1, totalDays - index);
      segments.push({
        label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        span,
      });
      index += span;
    }
    return segments;
  }, [range.start, totalDays]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      const todayX = labelWidth + daysBetween(range.start, today) * px + px / 2;
      node.scrollLeft = Math.max(0, todayX - node.clientWidth * 0.35);
    });
    return () => cancelAnimationFrame(frame);
  }, [labelWidth, px, range.start, today]);

  function barBox(bar: Bar) {
    const start = daysBetween(range.start, parseISODate(bar.start));
    const span = Math.max(1, daysBetween(parseISODate(bar.start), parseISODate(bar.due)) + 1);
    return { left: start * px, width: span * px };
  }

  const todayX = daysBetween(range.start, today) * px;

  return (
    <div data-testid="gantt">
      <PageHeader
        title="Timeline"
        lede="Projects sit above their tasks. Lines run from a predecessor to the work that follows it. Rust bars are late."
        action={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              size="sm"
              variant={zoom === "schedule" ? "default" : "outline"}
              onClick={() => setZoom("schedule")}
            >
              Schedule
            </Button>
            <Button size="sm" variant={zoom === "days" ? "default" : "outline"} onClick={() => setZoom("days")}>
              Days
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const node = scrollerRef.current;
                if (!node) return;
                const x = labelWidth + todayX + px / 2;
                node.scrollLeft = Math.max(0, x - node.clientWidth * 0.35);
              }}
            >
              Today
            </Button>
          </div>
        }
      />

      {bars.length === 0 ? (
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
        <span>{links.length} predecessor links</span>
      </div>

      <div
        ref={scrollerRef}
        className="max-h-[calc(100dvh-13rem)] overflow-auto rounded-lg border bg-card"
        data-testid="gantt-scroll"
      >
        <div style={{ width: labelWidth + timelineWidth }}>
          <div className="sticky top-0 z-30 flex border-b bg-card">
            <div
              className="sticky left-0 z-40 flex shrink-0 items-end border-r bg-card px-3 pb-1 text-xs font-medium"
              style={{ width: labelWidth, height: 44 }}
            >
              Work
            </div>
            <div style={{ width: timelineWidth }}>
              <div className="flex h-6 border-b text-[11px]">
                {months.map((month) => (
                  <div
                    key={`${month.label}-${month.span}`}
                    className="shrink-0 truncate border-r px-1 leading-6"
                    style={{ width: month.span * px }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>
              <div className="relative h-5 text-[10px] text-muted-foreground">
                {Array.from({ length: totalDays }, (_, index) => {
                  const date = addDays(range.start, index);
                  if (date.getDay() !== 1) return null;
                  return (
                    <span key={index} className="absolute top-0.5" style={{ left: index * px }}>
                      {formatShort(formatISODate(date))}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ left: labelWidth, width: timelineWidth }}
            >
              {Array.from({ length: totalDays }, (_, index) => {
                const day = addDays(range.start, index).getDay();
                if (day !== 0 && day !== 6) return null;
                return (
                  <div
                    key={index}
                    className="absolute top-0 bottom-0 bg-[#22242c]"
                    style={{ left: index * px, width: px }}
                  />
                );
              })}
            </div>

            {bars.map((bar) => {
              const box = barBox(bar);
              return (
                <div key={bar.key} className="flex border-b" style={{ height: ROW }} data-testid="gantt-row">
                  <div
                    className={cn(
                      "sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-3",
                      bar.indent ? "text-xs text-muted-foreground" : "text-sm font-medium",
                    )}
                    style={{ width: labelWidth, paddingLeft: bar.indent ? 22 : 12 }}
                  >
                    <span className="truncate">{bar.label}</span>
                  </div>
                  <div className="relative" style={{ width: timelineWidth }}>
                    <div
                      title={bar.hint}
                      data-testid="gantt-bar"
                      data-tone={bar.tone}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 rounded-sm",
                        bar.indent ? "h-2.5" : "h-4",
                        toneClass(bar.tone),
                        bar.tone === "hold" && "opacity-80",
                      )}
                      style={{
                        left: box.left,
                        width: Math.max(box.width, 4),
                        backgroundImage:
                          bar.tone === "hold"
                            ? "repeating-linear-gradient(135deg, transparent, transparent 3px, rgb(255 255 255 / 0.35) 3px, rgb(255 255 255 / 0.35) 6px)"
                            : undefined,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <svg
              className="pointer-events-none absolute top-0 text-[#9ca3af]"
              style={{ left: labelWidth, width: timelineWidth, height: bars.length * ROW }}
              aria-label="Predecessor links"
            >
              <defs>
                <marker id="keel-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L7,3 L0,6 Z" fill="currentColor" />
                </marker>
              </defs>
              {links.map((link) => {
                const from = bars[indexByKey.get(link.from)!];
                const to = bars[indexByKey.get(link.to)!];
                const fromBox = barBox(from);
                const toBox = barBox(to);
                const x1 = fromBox.left + fromBox.width;
                const y1 = indexByKey.get(link.from)! * ROW + ROW / 2;
                const x2 = toBox.left;
                const y2 = indexByKey.get(link.to)! * ROW + ROW / 2;
                return (
                  <path
                    key={`${link.from}-${link.to}`}
                    d={linkPath(x1, y1, x2, y2)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={link.kind === "project" ? 1.75 : 1.15}
                    markerEnd="url(#keel-arrow)"
                    data-testid="dependency-link"
                    data-link-kind={link.kind}
                    className={link.kind === "project" ? "text-[#2dd4bf]" : "text-[#9ca3af]"}
                  />
                );
              })}
            </svg>

            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-[#f97066]"
              style={{ left: labelWidth + todayX + px / 2 }}
              data-testid="today-marker"
            />
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

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
