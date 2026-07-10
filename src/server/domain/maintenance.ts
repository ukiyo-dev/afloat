import { localDayKey } from "./time";
import type { ParsedEvent } from "./types";

export function maintenanceRate(
  events: ParsedEvent[],
  now: Date,
  days = 30,
  timezone = "UTC"
): number {
  if (days <= 0) {
    return 0;
  }

  const today = localDayKey(now, timezone);
  const includedDays = new Set(
    Array.from({ length: days }, (_, offset) => addDateKeyDays(today, -offset))
  );
  const maintainedDays = new Set<string>();

  for (const event of events) {
    const effectiveEnd = new Date(Math.min(event.endAt.getTime(), now.getTime()));
    if (event.startAt >= effectiveEnd) {
      continue;
    }

    const firstDay = localDayKey(event.startAt, timezone);
    const lastDay = localDayKey(new Date(effectiveEnd.getTime() - 1), timezone);
    let day = firstDay;

    while (day <= lastDay) {
      if (includedDays.has(day)) {
        maintainedDays.add(day);
      }
      day = addDateKeyDays(day, 1);
    }
  }

  return maintainedDays.size / days;
}

function addDateKeyDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return date.toISOString().slice(0, 10);
}
