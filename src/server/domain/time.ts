import type { DateRange } from "./types";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export function minutesBetween(startAt: Date, endAt: Date): number {
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / MS_PER_MINUTE);
}

export function minutesInRange(range: DateRange): number {
  return minutesBetween(range.startAt, range.endAt);
}

export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function intersection(a: DateRange, b: DateRange): DateRange | null {
  if (!overlaps(a, b)) {
    return null;
  }

  return {
    startAt: new Date(Math.max(a.startAt.getTime(), b.startAt.getTime())),
    endAt: new Date(Math.min(a.endAt.getTime(), b.endAt.getTime()))
  };
}

export function subtractRanges<T extends DateRange>(
  range: T,
  blockers: DateRange[]
): DateRange[] {
  let remaining: DateRange[] = [{ startAt: range.startAt, endAt: range.endAt }];

  for (const blocker of blockers) {
    remaining = remaining.flatMap((part) => {
      const cut = intersection(part, blocker);
      if (!cut) {
        return [part];
      }

      const pieces: DateRange[] = [];
      if (part.startAt < cut.startAt) {
        pieces.push({ startAt: part.startAt, endAt: cut.startAt });
      }
      if (cut.endAt < part.endAt) {
        pieces.push({ startAt: cut.endAt, endAt: part.endAt });
      }
      return pieces;
    });
  }

  return remaining.filter((part) => part.startAt < part.endAt);
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function localDayKey(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to UTC if persisted settings contain an invalid timezone.
  }

  return dayKey(date);
}

export function localDayRange(day: string, timezone: string): DateRange {
  const startAt = localMidnightToUtc(day, timezone);
  const endAt = localMidnightToUtc(addDayKey(day, 1), timezone);
  return { startAt, endAt };
}

function localMidnightToUtc(day: string, timezone: string): Date {
  const localAsUtc = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(localAsUtc.getTime())) {
    throw new Error(`Invalid local day: ${day}`);
  }

  let guess = localAsUtc;
  try {
    for (let index = 0; index < 3; index += 1) {
      guess = new Date(localAsUtc.getTime() - timezoneOffsetMs(guess, timezone));
    }
    return guess;
  } catch {
    return localAsUtc;
  }
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const zonedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );
  return zonedAsUtc - date.getTime();
}

function addDayKey(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}

export function daysBetween(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.ceil((endAt.getTime() - startAt.getTime()) / MS_PER_DAY));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
