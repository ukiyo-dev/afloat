import type { DashboardData } from "@/server/services/dashboard-service";

const MS_PER_MINUTE = 60_000;

type TimelineFact = DashboardData["view"]["timeline"][number];

export interface MacroDistributionDay {
  date: string;
  displayDate: string;
  total: number;
  kinds: Record<string, number>;
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

interface DateRange {
  startAt: Date;
  endAt: Date;
}

export function buildMacroDistributionDays({
  timeline,
  timezone,
  startDate,
  endDate
}: {
  timeline: DashboardData["view"]["timeline"];
  timezone: string;
  startDate: string;
  endDate: string;
}): MacroDistributionDay[] {
  const days = buildDays(startDate, endDate);
  const dayRanges = days.map((day) => {
    const localDate = localDateFromKey(day.date);
    const nextDate = addLocalDays(localDate, 1);

    return {
      day,
      range: {
        startAt: localMidnightToUtc(localDate, timezone),
        endAt: localMidnightToUtc(nextDate, timezone)
      }
    };
  });

  for (const fact of timeline) {
    const factRange = {
      startAt: new Date(fact.startAt),
      endAt: new Date(fact.endAt)
    };

    for (const { day, range } of dayRanges) {
      const minutes = clippedMinutes(factRange, range);
      if (minutes <= 0) continue;

      day.total += minutes;
      day.kinds[fact.kind] = (day.kinds[fact.kind] ?? 0) + minutes;
    }
  }

  return days;
}

function buildDays(startDate: string, endDate: string): MacroDistributionDay[] {
  const days: MacroDistributionDay[] = [];
  let cursor = localDateFromKey(startDate);
  const end = endDate;

  while (formatLocalDate(cursor) <= end) {
    days.push({
      date: formatLocalDate(cursor),
      displayDate: `${cursor.month}月${cursor.day}日`,
      total: 0,
      kinds: {}
    });
    cursor = addLocalDays(cursor, 1);
  }

  return days;
}

function clippedMinutes(segment: DateRange, range: DateRange): number {
  const start = Math.max(segment.startAt.getTime(), range.startAt.getTime());
  const end = Math.min(segment.endAt.getTime(), range.endAt.getTime());
  return Math.max(0, (end - start) / MS_PER_MINUTE);
}

function localDateFromKey(value: string): LocalDate {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function localMidnightToUtc(date: LocalDate, timezone: string): Date {
  const localAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  let guess = new Date(localAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const offset = timezoneOffsetMs(guess, timezone);
    guess = new Date(localAsUtc - offset);
  }

  return guess;
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

function formatLocalDate(date: LocalDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
