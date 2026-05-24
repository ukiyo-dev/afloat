import { addDays, localDayKey } from "./time";
import type { ParsedEvent } from "./types";

export function maintenanceRate(
  events: ParsedEvent[],
  now: Date,
  days = 30,
  timezone = "UTC"
): number {
  const startAt = addDays(now, -days);
  const maintainedDays = new Set(
    events
      .filter((event) => event.endAt > startAt && event.startAt <= now)
      .map((event) => localDayKey(event.startAt, timezone))
  );

  return maintainedDays.size / days;
}
