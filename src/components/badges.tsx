import { Badge } from "@/components/ui/badge";
import { HEALTH_LABEL, LOAD_LABEL, PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Health, LoadLevel, Priority, ProjectStatus, TaskStatus } from "@/lib/types";
import { cn } from "cn";

const healthClass: Record<Health, string> = {
  on_track: "border-[#34d399]/45 bg-[#34d399]/15 text-[#6ee7b7]",
  off_track: "border-[#fb923c]/50 bg-[#fb923c]/15 text-[#fdba74]",
  on_hold: "border-[#2e303a] bg-[#22242c] text-[#9ca3af]",
  done: "border-[#2dd4bf]/45 bg-[#2dd4bf]/15 text-[#5eead4]",
};

const loadClass: Record<LoadLevel, string> = {
  comfortable: "border-[#34d399]/45 bg-[#34d399]/15 text-[#6ee7b7]",
  busy: "border-[#fbbf24]/50 bg-[#fbbf24]/15 text-[#fcd34d]",
  overloaded: "border-[#fb923c]/50 bg-[#fb923c]/15 text-[#fdba74]",
};

const projectStatusClass: Record<ProjectStatus, string> = {
  active: "border-[#2dd4bf]/45 bg-[#2dd4bf]/15 text-[#5eead4]",
  on_hold: "border-[#2e303a] bg-[#22242c] text-[#9ca3af]",
  done: "border-[#34d399]/45 bg-[#34d399]/15 text-[#6ee7b7]",
};

export function ProjectStatusBadge({ status, testId }: { status: ProjectStatus; testId?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5", projectStatusClass[status])}
      data-testid={testId}
      data-status={status}
    >
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function HealthBadge({ health, testId }: { health: Health; testId?: string }) {
  return (
    <Badge variant="outline" className={cn("h-5", healthClass[health])} data-testid={testId} data-health={health}>
      {HEALTH_LABEL[health]}
    </Badge>
  );
}

export function LoadBadge({ level }: { level: LoadLevel }) {
  return (
    <Badge variant="outline" className={cn("h-5", loadClass[level])} data-load={level}>
      {LOAD_LABEL[level]}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className="h-5 border-border bg-background text-foreground">
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "text-xs font-medium",
        priority === "high" && "text-[#fb923c]",
        priority === "medium" && "text-foreground",
        priority === "low" && "text-muted-foreground",
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
