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

export function daysBetween(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.ceil((endAt.getTime() - startAt.getTime()) / MS_PER_DAY));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
