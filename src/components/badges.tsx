import { Badge } from "@/components/ui/badge";
import { HEALTH_LABEL, LOAD_LABEL, PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Health, LoadLevel, Priority, TaskStatus } from "@/lib/types";
import { cn } from "cn";

const healthClass: Record<Health, string> = {
  on_track: "border-emerald-300 bg-emerald-50 text-emerald-950",
  off_track: "border-orange-400 bg-orange-50 text-orange-950",
  on_hold: "border-stone-300 bg-stone-100 text-stone-700",
  done: "border-teal-300 bg-teal-50 text-teal-950",
};

const loadClass: Record<LoadLevel, string> = {
  comfortable: "border-emerald-300 bg-emerald-50 text-emerald-950",
  busy: "border-amber-300 bg-amber-50 text-amber-950",
  overloaded: "border-orange-400 bg-orange-50 text-orange-950",
};

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
        priority === "high" && "text-orange-800",
        priority === "medium" && "text-foreground",
        priority === "low" && "text-muted-foreground",
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
