import type { DashboardData } from "@/server/services/dashboard-service";
import { isThreadActivity, threadActivityKeys } from "./thread-activity-style";

const MS_PER_MINUTE = 60_000;

type TimelineFact = DashboardData["view"]["timeline"][number];
type PlanEntry = DashboardData["view"]["planTimeline"][number];

export interface MacroDistributionDay {
  date: string;
  displayDate: string;
  total: number;
  kinds: Record<string, number>;
  threadKinds: Record<string, number>;
}

export type MacroThreadScope = "non" | "thread";

export function filterMacroDistributionDay(
  day: MacroDistributionDay,
  kinds: string[] | null,
  scopes: ReadonlySet<MacroThreadScope>
): MacroDistributionDay {
  const filteredKinds: Record<string, number> = {};
  const filteredThreadKinds: Record<string, number> = {};

  for (const [kind, minutes] of Object.entries(day.kinds)) {
    if (kinds !== null && !kinds.includes(kind)) continue;

    const threadMinutes = day.threadKinds[kind] ?? 0;
    const nonThreadMinutes = Math.max(0, minutes - threadMinutes);
    const visibleThreadMinutes = scopes.has("thread") ? threadMinutes : 0;
    const visibleMinutes = visibleThreadMinutes + (scopes.has("non") ? nonThreadMinutes : 0);

    if (visibleMinutes > 0) filteredKinds[kind] = visibleMinutes;
    if (visibleThreadMinutes > 0) filteredThreadKinds[kind] = visibleThreadMinutes;
  }

  return {
    ...day,
    total: Object.values(filteredKinds).reduce((total, minutes) => total + minutes, 0),
    kinds: filteredKinds,
    threadKinds: filteredThreadKinds
  };
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
  planTimeline = [],
  now,
  timezone,
  startDate,
  endDate,
  threads = []
}: {
  timeline: DashboardData["view"]["timeline"];
  planTimeline?: DashboardData["view"]["planTimeline"];
  now?: string;
  timezone: string;
  startDate: string;
  endDate: string;
  threads?: DashboardData["view"]["threads"];
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

  const nowAt = now ? new Date(now) : null;
  const validNow = nowAt && Number.isFinite(nowAt.getTime()) ? nowAt : null;
  const threadKeys = threadActivityKeys(threads);

  addSegments(timeline, validNow ? { endAt: validNow } : {}, dayRanges, threadKeys);
  if (validNow) {
    addSegments(planTimeline, { startAt: validNow }, dayRanges, threadKeys);
  }

  return days;
}

function addSegments(
  segments: Array<TimelineFact | PlanEntry>,
  boundary: { startAt?: Date; endAt?: Date },
  dayRanges: Array<{ day: MacroDistributionDay; range: DateRange }>,
  threadKeys: Set<string>
) {
  for (const segment of segments) {
    const segmentRange = {
      startAt: new Date(
        Math.max(new Date(segment.startAt).getTime(), boundary.startAt?.getTime() ?? -Infinity)
      ),
      endAt: new Date(
        Math.min(new Date(segment.endAt).getTime(), boundary.endAt?.getTime() ?? Infinity)
      )
    };

    if (
      !Number.isFinite(segmentRange.startAt.getTime()) ||
      !Number.isFinite(segmentRange.endAt.getTime()) ||
      segmentRange.endAt <= segmentRange.startAt
    ) {
      continue;
    }

    for (const { day, range } of dayRanges) {
      const minutes = clippedMinutes(segmentRange, range);
      if (minutes <= 0) continue;

      day.total += minutes;
      day.kinds[segment.kind] = (day.kinds[segment.kind] ?? 0) + minutes;
      if (isThreadActivity(segment, threadKeys)) {
        day.threadKinds[segment.kind] = (day.threadKinds[segment.kind] ?? 0) + minutes;
      }
    }
  }
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
      kinds: {},
      threadKinds: {}
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
