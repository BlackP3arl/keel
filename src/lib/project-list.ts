import type { Developer, Project, ProjectStatus, Task } from "@/lib/types";
import { shownProgress, projectHealth } from "@/lib/status";

export type ProjectListSortKey = "name" | "status" | "owner" | "start" | "due" | "progress" | "tasks";

const statusRank: Record<ProjectStatus, number> = {
  active: 0,
  on_hold: 1,
  done: 2,
};

export type ProjectListRow = {
  project: Project;
  owner: Developer | undefined;
  tasks: Task[];
  progress: number;
  doneCount: number;
};

export function buildProjectListRows(
  projects: Project[],
  tasks: Task[],
  developerById: Map<string, Developer>,
  today: Date,
): ProjectListRow[] {
  return projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const health = projectHealth(project, projectTasks, today);
    return {
      project,
      owner: developerById.get(project.ownerId),
      tasks: projectTasks,
      progress: shownProgress(projectTasks, health),
      doneCount: projectTasks.filter((task) => task.status === "done").length,
    };
  });
}

export function filterAndSortProjectRows(
  rows: ProjectListRow[],
  {
    status,
    query,
    sortKey,
    sortDir,
  }: {
    status: "all" | ProjectStatus;
    query: string;
    sortKey: ProjectListSortKey;
    sortDir: "asc" | "desc";
  },
): ProjectListRow[] {
  const needle = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (status !== "all" && row.project.status !== status) return false;
    if (!needle) return true;
    const ownerName = row.owner?.name.toLowerCase() ?? "";
    return row.project.name.toLowerCase().includes(needle) || ownerName.includes(needle);
  });

  const value = (row: ProjectListRow) => {
    switch (sortKey) {
      case "name":
        return row.project.name.toLowerCase();
      case "status":
        return statusRank[row.project.status];
      case "owner":
        return row.owner?.name.toLowerCase() ?? "";
      case "start":
        return row.project.start;
      case "due":
        return row.project.due;
      case "progress":
        return row.progress;
      case "tasks":
        return row.tasks.length;
    }
  };

  return filtered.sort((a, b) => {
    const left = value(a);
    const right = value(b);
    const compared = left < right ? -1 : left > right ? 1 : a.project.name.localeCompare(b.project.name);
    return sortDir === "asc" ? compared : -compared;
  });
}
