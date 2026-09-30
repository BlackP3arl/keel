"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  dueFromDuration,
  formatMedium,
  inclusiveDays,
  isISODate,
  isWeekend,
  parseISODate,
} from "@/lib/dates";
import { cn } from "cn";

export type ScheduleValue = {
  start: string;
  due: string;
  duration: string;
};

const WEEKDAYS = [
  { label: "Sun", weekend: false },
  { label: "Mon", weekend: false },
  { label: "Tue", weekend: false },
  { label: "Wed", weekend: false },
  { label: "Thu", weekend: false },
  { label: "Fri", weekend: true },
  { label: "Sat", weekend: true },
];

function monthStart(iso: string): Date {
  const date = parseISODate(iso);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(month: Date, amount: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

function monthCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function isoFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateRangeField({
  start,
  due,
  duration,
  onChange,
}: {
  start: string;
  due: string;
  duration: string;
  onChange: (next: ScheduleValue) => void;
}) {
  const [view, setView] = useState(() => monthStart(isISODate(start) ? start : isoFromDate(new Date())));
  const [pickingEnd, setPickingEnd] = useState(due === "");
  const days = monthCells(view);
  const title = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function chooseDay(iso: string) {
    if (!pickingEnd || !isISODate(start)) {
      onChange({ start: iso, due: "", duration: "" });
      setPickingEnd(true);
      return;
    }
    if (iso < start) {
      onChange({ start: iso, due: "", duration: "" });
      setPickingEnd(true);
      return;
    }
    onChange({ start, due: iso, duration: String(inclusiveDays(start, iso)) });
    setPickingEnd(false);
  }

  function changeDuration(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) {
      onChange({ start, due: "", duration: "" });
      setPickingEnd(true);
      return;
    }
    const daysCount = Number(digits);
    if (!Number.isInteger(daysCount) || daysCount < 1 || !isISODate(start)) {
      onChange({ start, due: "", duration: digits });
      setPickingEnd(true);
      return;
    }
    const nextDue = dueFromDuration(start, daysCount);
    onChange({ start, due: nextDue, duration: digits });
    setPickingEnd(false);
    setView(monthStart(nextDue));
  }

  return (
    <div className="grid gap-2" data-testid="task-schedule">
      <div className="rounded-lg border border-border bg-background p-2" data-testid="task-calendar">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setView((current) => shiftMonth(current, -1))}>
            <ChevronLeft />
          </Button>
          <p className="text-sm font-medium">{title}</p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setView((current) => shiftMonth(current, 1))}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] tracking-wide text-muted-foreground uppercase">
          {WEEKDAYS.map((day) => (
            <span key={day.label} className={cn("py-1", day.weekend && "text-[#f6e7c1]")}>
              {day.label}
              {day.weekend ? <span className="mt-0.5 block text-[8px] normal-case">Weekend</span> : null}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((date) => {
            const iso = isoFromDate(date);
            const outside = date.getMonth() !== view.getMonth();
            const weekend = isWeekend(date);
            const endpoint = iso === start || (due !== "" && iso === due);
            const between = due !== "" && iso > start && iso < due;
            return (
              <button
                key={iso}
                type="button"
                data-testid="calendar-day"
                data-date={iso}
                data-weekend={weekend ? "true" : "false"}
                data-selected={endpoint ? "true" : "false"}
                aria-pressed={endpoint}
                aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${weekend ? ", weekend" : ""}`}
                onClick={() => chooseDay(iso)}
                className={cn(
                  "flex h-10 flex-col items-center justify-center rounded-md text-xs tabular-nums hover:bg-white/10",
                  outside && "opacity-40",
                  weekend && "text-[#f6e7c1] shadow-[inset_0_0_0_999px_rgba(214,164,92,0.18)]",
                  between && "bg-primary/15",
                  endpoint && "ring-2 ring-primary",
                )}
              >
                <span>{date.getDate()}</span>
                {weekend ? <span className="text-[8px] leading-none tracking-wide uppercase">Off</span> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Friday and Saturday are the weekend. They stay selectable.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem]">
        <div className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Start</span>
          <p className="text-sm tabular-nums" data-testid="task-start" data-iso={start}>
            {isISODate(start) ? formatMedium(start) : "Not set"}
          </p>
        </div>
        <div className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Due</span>
          <p className="text-sm tabular-nums" data-testid="task-due" data-iso={due}>
            {isISODate(due) ? formatMedium(due) : "Not set"}
          </p>
        </div>
        <div className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Duration</span>
          <Input
            inputMode="numeric"
            value={duration}
            placeholder="Days"
            aria-label="Duration in days"
            data-testid="task-duration"
            onChange={(event) => changeDuration(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Inclusive calendar days. 1 day means the due date is the start date.
      </p>
    </div>
  );
}
