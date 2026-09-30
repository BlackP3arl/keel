export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Friday and Saturday. Sunday through Thursday are ordinary days. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6;
}

/** Inclusive calendar days. A same-day range is 1. */
export function inclusiveDays(startIso: string, dueIso: string): number {
  return daysBetween(parseISODate(startIso), parseISODate(dueIso)) + 1;
}

/** Due date for an inclusive duration. 1 day keeps the start date. */
export function dueFromDuration(startIso: string, durationDays: number): string {
  return formatISODate(addDays(parseISODate(startIso), durationDays - 1));
}

export function formatShort(iso: string): string {
  if (!isISODate(iso)) return "—";
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Compact board date: Today, Tomorrow, a weekday this week (Fri), otherwise Oct 27. */
export function formatBoardDue(iso: string, today: Date): string {
  if (!isISODate(iso)) return "—";
  const due = startOfDay(parseISODate(iso));
  const now = startOfDay(today);
  const delta = daysBetween(now, due);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  const weekEnd = addDays(now, 6 - now.getDay());
  if (delta > 1 && due.getTime() <= weekEnd.getTime()) {
    return WEEKDAY_SHORT[due.getDay()];
  }
  return formatShort(iso);
}

export function formatMedium(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDayHeading(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Due day is before today. A task due today is not overdue. */
export function isPastDue(iso: string, today: Date): boolean {
  return daysBetween(parseISODate(iso), startOfDay(today)) > 0;
}
