"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { HealthBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProjectDialog } from "@/components/editors";
import { EmptyState } from "@/components/page-header";
import { PersonSelect, PredecessorSelect } from "@/components/pickers";
import { TaskTable } from "@/components/task-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatMedium } from "@/lib/dates";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { wouldCreateCycle } from "@/lib/links";
import { healthReason, projectHealth, shownProgress } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { ProjectStatus } from "@/lib/types";

export function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const desk = useDesk();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = desk.projectById.get(id);
  const tasks = desk.tasks.filter((task) => task.projectId === id);

  if (!project) {
    return (
      <EmptyState
        title="That project is not on the desk"
        body="It may have been deleted in this browser."
        action={
          <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
            Back to projects
          </Link>
        }
      />
    );
  }

  const health = projectHealth(project, tasks, today);
  const progress = shownProgress(tasks, health);
  const percent = Math.round(progress * 100);
  const owner = desk.developerById.get(project.ownerId);
  const predecessor = project.predecessorProjectId
    ? desk.projectById.get(project.predecessorProjectId)
    : null;

  const predecessorOptions = desk.projects
    .filter((item) => item.id !== project.id)
    .filter(
      (item) =>
        !wouldCreateCycle(
          desk.projects.map((entry) => ({
            id: entry.id,
            predecessorId: entry.id === project.id ? project.predecessorProjectId : entry.predecessorProjectId,
          })),
          project.id,
          item.id,
        ),
    )
    .map((item) => ({ value: item.id, label: item.name }));

  function apply(patch: Partial<Omit<typeof project, "id">>) {
    const result = desk.updateProject(project!.id, patch);
    if (!result.ok) toast.error(result.reason);
  }

  function setStatus(status: ProjectStatus) {
    const result = desk.updateProject(project!.id, { status });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    if (status === "on_hold") toast(`${project!.name} is on hold.`);
    if (status === "done") toast(`${project!.name} is marked done.`);
    if (status === "active") toast(`${project!.name} is active again.`);
  }

  return (
    <div data-testid="project-detail" data-project-id={project.id}>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-[1.65rem] leading-tight tracking-tight">{project.name}</h1>
            <HealthBadge health={health} testId="project-health" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{project.summary}</p>
          <p className="mt-2 text-sm">{healthReason(project, tasks, today, health)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit details
          </Button>
          {project.status !== "on_hold" ? (
            <Button variant="outline" data-testid="hold-project" onClick={() => setStatus("on_hold")}>
              Put on hold
            </Button>
          ) : (
            <Button variant="outline" data-testid="resume-project" onClick={() => setStatus("active")}>
              Resume
            </Button>
          )}
          {project.status !== "done" ? (
            <Button data-testid="complete-project" onClick={() => setStatus("done")}>
              Mark done
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus("active")}>
              Reopen
            </Button>
          )}
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={percent} className="max-w-sm min-w-0 flex-1" aria-label="Project progress" />
        <span className="text-sm tabular-nums">{percent}%</span>
        <span className="text-sm text-muted-foreground">{PROJECT_STATUS_LABEL[project.status]}</span>
      </div>

      <div className="mt-5 grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <PersonSelect
          label="Owner"
          value={project.ownerId}
          developers={desk.developers}
          onValueChange={(ownerId) => apply({ ownerId })}
          testId="detail-owner"
        />
        <PredecessorSelect
          label="Predecessor project"
          value={project.predecessorProjectId}
          options={predecessorOptions}
          onValueChange={(predecessorProjectId) => apply({ predecessorProjectId })}
          hint={
            predecessor
              ? `Follows ${predecessor.name}. Loops are hidden.`
              : "Loops are hidden. Leave this empty if nothing has to finish first."
          }
          testId="detail-predecessor"
        />
        <div className="grid gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Start</span>
          <Input
            type="date"
            value={project.start}
            onChange={(event) => {
              if (event.target.value) apply({ start: event.target.value });
            }}
          />
          <span className="text-xs text-muted-foreground">{formatMedium(project.start)}</span>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Due</span>
          <Input
            type="date"
            value={project.due}
            data-testid="detail-due"
            onChange={(event) => {
              if (event.target.value) apply({ due: event.target.value });
            }}
          />
          <span className="text-xs text-muted-foreground">{formatMedium(project.due)}</span>
        </div>
        {owner ? (
          <p className="text-sm text-muted-foreground md:col-span-2">
            {owner.name} · {owner.role} · {owner.department}
            <span className="block">{owner.email}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-8">
        <TaskTable
          projectId={project.id}
          heading="Tasks"
          lede="Work on this project only. Change a status from its row, or open a task to edit the assignee, dates, or predecessor."
        />
      </div>

      <ProjectDialog open={editing} onOpenChange={setEditing} project={project} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${project.name}?`}
        body="Tasks on this project are removed with it."
        confirmLabel="Delete project"
        onConfirm={() => {
          desk.deleteProject(project.id);
          router.push("/");
        }}
      />
    </div>
  );
}
