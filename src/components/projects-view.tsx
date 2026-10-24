"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectStatusBadge } from "@/components/badges";
import { ProjectDialog } from "@/components/editors";
import { EmptyState, PageHeader } from "@/components/page-header";
import { LabeledSelect, SearchField } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMedium } from "@/lib/dates";
import { PROJECT_STATUS_LABEL, PROJECT_STATUSES } from "@/lib/labels";
import { buildProjectListRows, filterAndSortProjectRows, type ProjectListSortKey } from "@/lib/project-list";
import { useDesk } from "@/lib/store";
import type { ProjectStatus } from "@/lib/types";

export function ProjectsView() {
  const desk = useDesk();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [status, setStatus] = useState<"all" | ProjectStatus>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ProjectListSortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    return filterAndSortProjectRows(buildProjectListRows(desk.projects, desk.tasks, desk.developerById, today), {
      status,
      query,
      sortKey,
      sortDir,
    });
  }, [desk.developerById, desk.projects, desk.tasks, query, sortDir, sortKey, status, today]);

  function toggleSort(key: ProjectListSortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const filtersActive = status !== "all" || query.trim().length > 0;

  return (
    <div data-testid="projects">
      <PageHeader
        title="Projects"
        lede="Every project on the desk. Filter by status, sort a column, and open a row to edit it."
        action={
          <Button onClick={() => setCreating(true)} data-testid="new-project">
            <Plus />
            New project
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Project or owner"
          testId="project-search"
        />
        <LabeledSelect
          label="Status"
          value={status}
          onValueChange={(value) => setStatus(value as "all" | ProjectStatus)}
          testId="filter-project-status"
          options={[
            { value: "all", label: "Any status" },
            ...PROJECT_STATUSES.map((item) => ({ value: item, label: PROJECT_STATUS_LABEL[item] })),
          ]}
        />
        {filtersActive ? (
          <Button
            variant="outline"
            className="self-end"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {desk.projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Create a project to put work on the desk."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New project
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No projects match that filter.
        </p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Project" sortKey="name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Status" sortKey="status" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Owner" sortKey="owner" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Start" sortKey="start" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Due" sortKey="due" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Progress" sortKey="progress" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead label="Tasks" sortKey="tasks" active={sortKey} dir={sortDir} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const percent = Math.round(row.progress * 100);
                return (
                  <TableRow
                    key={row.project.id}
                    data-testid="project-row"
                    data-project-id={row.project.id}
                    data-status={row.project.status}
                    className="cursor-pointer"
                    onClick={() => router.push(`/projects/${row.project.id}`)}
                  >
                    <TableCell className="max-w-64 font-medium whitespace-normal">
                      <Link
                        href={`/projects/${row.project.id}`}
                        className="hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={row.project.status} />
                    </TableCell>
                    <TableCell>
                      <span title={row.owner ? `${row.owner.role} · ${row.owner.department}` : undefined}>
                        {row.owner?.name ?? "No owner"}
                      </span>
                    </TableCell>
                    <TableCell>{formatMedium(row.project.start)}</TableCell>
                    <TableCell>{formatMedium(row.project.due)}</TableCell>
                    <TableCell>
                      <div className="flex min-w-36 items-center gap-2">
                        <Progress
                          value={percent}
                          aria-label={`${row.project.name} progress`}
                          className="min-w-0 flex-1"
                        />
                        <span className="w-10 text-right text-xs tabular-nums">{percent}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.doneCount}/{row.tasks.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProjectDialog open={creating} onOpenChange={setCreating} />
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
  sortKey: ProjectListSortKey;
  active: ProjectListSortKey;
  dir: "asc" | "desc";
  onSort: (key: ProjectListSortKey) => void;
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
