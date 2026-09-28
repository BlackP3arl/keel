"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Info, Plus } from "lucide-react";
import { HealthBadge } from "@/components/badges";
import { ProjectDialog } from "@/components/editors";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDayHeading, formatMedium } from "@/lib/dates";
import { HEALTH_LABEL, HEALTH_RANK } from "@/lib/labels";
import { projectHealth, shownProgress } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { Health } from "@/lib/types";

const HEALTHS: Health[] = ["on_track", "off_track", "on_hold", "done"];

export function DashboardView() {
  const desk = useDesk();
  const [creating, setCreating] = useState(false);
  const today = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    return desk.projects
      .map((project) => {
        const tasks = desk.tasks.filter((task) => task.projectId === project.id);
        const health = projectHealth(project, tasks, today);
        return {
          project,
          tasks,
          health,
          progress: shownProgress(tasks, health),
          owner: desk.developerById.get(project.ownerId),
        };
      })
      .sort((a, b) => {
        const byHealth = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
        if (byHealth !== 0) return byHealth;
        return a.project.due.localeCompare(b.project.due);
      });
  }, [desk.developerById, desk.projects, desk.tasks, today]);

  const counts = Object.fromEntries(
    HEALTHS.map((health) => [health, rows.filter((row) => row.health === health).length]),
  ) as Record<Health, number>;

  return (
    <div data-testid="dashboard">
      <PageHeader
        title="Delivery desk"
        lede={`${formatDayHeading(today)}. ${desk.developers.length} people, ${desk.projects.length} projects. On track and off track are calculated from dates and finished tasks.`}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New project
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {HEALTHS.map((health) => (
          <div key={health} className="rounded-lg border bg-card px-3 py-3" data-testid={`stat-${health}`}>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {HEALTH_LABEL[health]}
              </p>
              {health === "off_track" ? (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="How off track is decided"
                    className="text-muted-foreground"
                  >
                    <Info className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Off track when the due date has passed, or finished tasks trail the elapsed schedule by more than 20 points. On hold is never called late.
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <p className="mt-1 font-heading text-3xl tabular-nums">{counts[health]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        {rows.map((row) => {
          const percent = Math.round(row.progress * 100);
          return (
            <Link
              key={row.project.id}
              href={`/projects/${row.project.id}`}
              data-testid="project-card"
              data-project-id={row.project.id}
              data-health={row.health}
              className="block rounded-lg border bg-card px-4 py-3 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{row.project.name}</h2>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{row.project.summary}</p>
                </div>
                <HealthBadge health={row.health} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span title={row.owner ? `${row.owner.role} · ${row.owner.email}` : undefined}>
                  {row.owner ? `${row.owner.name} · ${row.owner.department}` : "No owner"}
                </span>
                <span>
                  {formatMedium(row.project.start)} – {formatMedium(row.project.due)}
                </span>
                <span>
                  {row.tasks.filter((task) => task.status === "done").length}/{row.tasks.length} tasks done
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={percent} aria-label={`${row.project.name} progress`} className="min-w-0 flex-1" />
                <span className="w-10 text-right text-xs tabular-nums">{percent}%</span>
              </div>
            </Link>
          );
        })}
      </div>

      <ProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
