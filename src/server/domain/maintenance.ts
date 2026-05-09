import { addDays, dayKey } from "./time";
import type { ParsedEvent } from "./types";

export function maintenanceRate(events: ParsedEvent[], now: Date, days = 30): number {
  const startAt = addDays(now, -days);
  const maintainedDays = new Set(
    events
      .filter((event) => event.endAt > startAt && event.startAt <= now)
      .map((event) => dayKey(event.startAt))
  );

  return maintainedDays.size / days;
}
