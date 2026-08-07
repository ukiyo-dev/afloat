import type { DashboardData } from "@/server/services/dashboard-service";
import type { ThreadActivityAttribution } from "@/server/views/derived-view";
import { clippedMinutes } from "@/server/domain/commitment-stats";
import {
  addLocalDays,
  formatLocalDate,
  localDateFromKey,
  localMidnightToUtc,
} from "@/server/domain/time";
import type { LocalDate } from "@/server/domain/time";
import type { DateRange } from "@/server/domain/types";
import { threadAttributionMinutes } from "@/server/domain/thread-attribution";

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

export function buildMacroDistributionDays({
  timeline,
  planTimeline = [],
  now,
  timezone,
  startDate,
  endDate,
  attributions
}: {
  timeline: DashboardData["view"]["timeline"];
  planTimeline?: DashboardData["view"]["planTimeline"];
  now?: string;
  timezone: string;
  startDate: string;
  endDate: string;
  attributions: ThreadActivityAttribution[];
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
  addSegments(timeline, validNow ? { endAt: validNow } : {}, dayRanges, attributions);
  if (validNow) {
    addSegments(planTimeline, { startAt: validNow }, dayRanges, attributions);
  }

  return days;
}

function addSegments(
  segments: Array<TimelineFact | PlanEntry>,
  boundary: { startAt?: Date; endAt?: Date },
  dayRanges: Array<{ day: MacroDistributionDay; range: DateRange }>,
  attributions: ThreadActivityAttribution[]
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
      const clippedStart = new Date(Math.max(segmentRange.startAt.getTime(), range.startAt.getTime()));
      const clippedEnd = new Date(Math.min(segmentRange.endAt.getTime(), range.endAt.getTime()));
      const threadMinutes = threadAttributionMinutes({
        ...segment,
        startAt: clippedStart.toISOString(),
        endAt: clippedEnd.toISOString()
      }, attributions);
      if (threadMinutes > 0) {
        day.threadKinds[segment.kind] = (day.threadKinds[segment.kind] ?? 0) + threadMinutes;
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
