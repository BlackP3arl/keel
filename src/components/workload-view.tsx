"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadBadge } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect } from "@/components/pickers";
import { formatShort } from "@/lib/dates";
import { DEPARTMENTS } from "@/lib/labels";
import { isTaskOverdue, loadLevel } from "@/lib/status";
import { useDesk } from "@/lib/store";
import type { Department } from "@/lib/types";

export function WorkloadView() {
  const desk = useDesk();
  const today = useMemo(() => new Date(), []);
  const [department, setDepartment] = useState<"all" | Department>("all");

  const rows = desk.developers.filter((person) => department === "all" || person.department === department).map((person) => {
    const assigned = desk.tasks.filter((task) => task.assigneeId === person.id);
    const open = assigned.filter((task) => task.status !== "done");
    const overdue = open.filter((task) => isTaskOverdue(task, today));
    const completed = assigned.filter((task) => task.status === "done");
    const projectIds = new Set<string>();
    for (const project of desk.projects) {
      if (project.ownerId === person.id) projectIds.add(project.id);
    }
    for (const task of assigned) projectIds.add(task.projectId);
    const projects = desk.projects.filter((project) => projectIds.has(project.id));
    return {
      person,
      open,
      overdue,
      completed,
      projects,
      load: loadLevel(open.length, overdue.length),
    };
  });

  return (
    <div data-testid="workload">
      <PageHeader
        title="Workload"
        lede="Everyone on the roster, across Software Engineering, Data Services, Cloud & Security, and IT. Comfortable is two or fewer open tasks and nothing overdue. Busy is three or four open, or one overdue. Overloaded is five or more open, or two or more overdue."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <LabeledSelect
          label="Department"
          value={department}
          onValueChange={(next) => setDepartment(next as "all" | Department)}
          testId="department-filter"
          options={[
            { value: "all", label: "All departments" },
            ...DEPARTMENTS.map((item) => ({ value: item, label: item })),
          ]}
        />
        <p className="pb-1 text-sm text-muted-foreground">
          {rows.length} of {desk.developers.length}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No one in that department" body="Choose another department, or show the full roster." />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <article
            key={row.person.id}
            data-testid="workload-person"
            data-developer-id={row.person.id}
            data-department={row.person.department}
            className="rounded-lg border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{row.person.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {row.person.role} · {row.person.department}
                </p>
                {row.person.email ? <p className="text-xs text-muted-foreground">{row.person.email}</p> : null}
              </div>
              <LoadBadge level={row.load} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {row.projects.length === 0 ? (
                <span className="text-xs text-muted-foreground">No project yet</span>
              ) : (
                row.projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs hover:border-foreground/30"
                  >
                    {project.name}
                    {project.ownerId === row.person.id ? " · owner" : ""}
                  </Link>
                ))
              )}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/70 px-2 py-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Open</dt>
                <dd className="font-heading text-xl tabular-nums">{row.open.length}</dd>
              </div>
              <div className="rounded-md bg-muted/70 px-2 py-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Overdue</dt>
                <dd className="font-heading text-xl tabular-nums text-[#f97066]">{row.overdue.length}</dd>
              </div>
              <div className="rounded-md bg-muted/70 px-2 py-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Done</dt>
                <dd className="font-heading text-xl tabular-nums">{row.completed.length}</dd>
              </div>
            </dl>
            {row.overdue.length > 0 ? (
              <ul className="mt-3 grid gap-1 text-sm">
                {row.overdue.slice(0, 3).map((task) => (
                  <li key={task.id} className="truncate text-[#f97066]">
                    {task.title}
                    <span className="text-[#f97066]/80"> · due {formatShort(task.due)}</span>
                  </li>
                ))}
                {row.overdue.length > 3 ? (
                  <li className="text-xs text-muted-foreground">+{row.overdue.length - 3} more overdue</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No overdue tasks.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
