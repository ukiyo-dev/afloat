import type { DashboardData } from "@/server/services/dashboard-service";

import { groupThreads } from "./utils";

type Thread = DashboardData["view"]["threads"][number];
type ThreadHistoryEntry = Thread["history"][number];
type HistoryProjection = {
  entries: ThreadHistoryEntry[];
  elapsedMinutes: number;
  elapsedKind: string | null;
};
type ElapsedTotals = {
  fulfilledMinutes: number;
  externalShiftMinutes: number;
  internalShiftMinutes: number;
  totalMinutes: number;
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const fulfilledKindByPlanKind: Record<string, string> = {
  ideal: "idealFulfilled",
  leisure: "leisureFulfilled",
  rest: "restFulfilled"
};

export function projectThreadsForNow(
  threads: DashboardData["view"]["threads"],
  runtimeNowIso: string,
  timezone: string,
  baseNowIso: string,
  staleDays = 7
): DashboardData["view"]["threads"] {
  const baseNow = new Date(baseNowIso);
  const runtimeNow = new Date(runtimeNowIso);
  if (Number.isNaN(baseNow.getTime()) || Number.isNaN(runtimeNow.getTime())) {
    return threads;
  }

  const minuteRuntimeNow = floorToMinute(runtimeNow);
  const projectionNow = minuteRuntimeNow > baseNow ? minuteRuntimeNow : baseNow;
  return threads.map((thread) => projectThreadForNow(thread, baseNow, projectionNow, timezone, staleDays));
}

function floorToMinute(value: Date): Date {
  return new Date(Math.floor(value.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE);
}

export function projectThreadGroupsForNow(
  threads: DashboardData["view"]["threads"],
  runtimeNowIso: string,
  timezone: string,
  baseNowIso: string,
  staleDays = 7
) {
  return groupThreads(projectThreadsForNow(threads, runtimeNowIso, timezone, baseNowIso, staleDays));
}

function projectThreadForNow(
  thread: Thread,
  baseNow: Date,
  runtimeNow: Date,
  timezone: string,
  staleDays: number
): Thread {
  const elapsed: ElapsedTotals = {
    fulfilledMinutes: 0,
    externalShiftMinutes: 0,
    internalShiftMinutes: 0,
    totalMinutes: 0
  };
  const projectedHistory = thread.history.flatMap((entry) => {
    const projected = projectHistoryEntryForNow(entry, baseNow, runtimeNow);
    addElapsedProjection(elapsed, projected);
    return projected.entries;
  });
  const history =
    thread.activityState === "untracked"
      ? projectedHistory
      : mergeAdjacentHistoryEntries(projectedHistory);

  const fulfilledMinutes = thread.fulfilledMinutes + elapsed.fulfilledMinutes;
  const externalShiftMinutes = thread.externalShiftMinutes + elapsed.externalShiftMinutes;
  const internalShiftMinutes = thread.internalShiftMinutes + elapsed.internalShiftMinutes;
  const futureMinutes = Math.max(0, thread.futureMinutes - elapsed.totalMinutes);
  const factGapMinutes =
    thread.expectedMinutes === null ? null : Math.max(0, thread.expectedMinutes - fulfilledMinutes);
  const unscheduledGapMinutes =
    thread.expectedMinutes === null
      ? null
      : Math.max(0, thread.expectedMinutes - fulfilledMinutes - futureMinutes);
  const planCoverageRate =
    factGapMinutes === null || factGapMinutes === 0 ? null : futureMinutes / factGapMinutes;
  const dailyRequiredMinutes =
    unscheduledGapMinutes !== null && thread.deadline
      ? dailyRequired(
          unscheduledGapMinutes,
          thread.start ?? localDayKey(runtimeNow, timezone),
          thread.deadline,
          runtimeNow,
          timezone
        )
      : null;
  const remainingDays = thread.deadline
    ? inclusiveDaysBetween(
        [localDayKey(runtimeNow, timezone), thread.start ?? localDayKey(runtimeNow, timezone)]
          .sort()
          .at(-1)!,
        thread.deadline
      )
    : null;
  const sortedHistory = history.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  const lastActivityAt = latestFactActivityAt(sortedHistory) ?? thread.lastActivityAt ?? null;

  return {
    ...thread,
    fulfilledMinutes,
    futureMinutes,
    externalShiftMinutes,
    internalShiftMinutes,
    factGapMinutes,
    unscheduledGapMinutes,
    planCoverageRate,
    dailyRequiredMinutes,
    remainingDays,
    status: projectedStatus({
      previousStatus: thread.status,
      activityState: thread.activityState ?? "active",
      factGapMinutes,
      unscheduledGapMinutes,
      dailyRequiredMinutes,
      start: thread.start ?? localDayKey(runtimeNow, timezone),
      deadline: thread.deadline,
      lastActivityAt,
      runtimeNow,
      timezone,
      staleDays
    }),
    lastActivityAt,
    history: sortedHistory
  };
}

function projectHistoryEntryForNow(
  entry: ThreadHistoryEntry,
  baseNow: Date,
  runtimeNow: Date
): HistoryProjection {
  if (entry.source !== "futurePlan") {
    return unchangedProjection(entry);
  }

  const startAt = new Date(entry.startAt);
  const endAt = new Date(entry.endAt);
  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    runtimeNow <= startAt ||
    runtimeNow <= baseNow
  ) {
    return unchangedProjection(entry);
  }

  const elapsedStart = new Date(Math.max(startAt.getTime(), baseNow.getTime()));
  const elapsedEnd = new Date(Math.min(endAt.getTime(), runtimeNow.getTime()));
  if (elapsedEnd <= elapsedStart) {
    return unchangedProjection(entry);
  }

  const factKind = fulfilledKind(entry.kind);
  const elapsedMinutes = minutesBetween(elapsedStart, elapsedEnd);
  const entries: ThreadHistoryEntry[] = [
    {
      ...entry,
      startAt: elapsedStart.toISOString(),
      endAt: elapsedEnd.toISOString(),
      kind: factKind,
      minutes: elapsedMinutes,
      source: "fact"
    }
  ];

  if (runtimeNow < endAt) {
    const remainingStart = new Date(Math.max(runtimeNow.getTime(), startAt.getTime()));
    const remainingMinutes = minutesBetween(remainingStart, endAt);
    if (remainingMinutes > 0) {
      entries.push({
        ...entry,
        startAt: remainingStart.toISOString(),
        endAt: endAt.toISOString(),
        minutes: remainingMinutes
      });
    }
  }

  return {
    entries,
    elapsedMinutes,
    elapsedKind: factKind
  };
}

function addElapsedProjection(totals: ElapsedTotals, projection: HistoryProjection): void {
  if (!projection.elapsedKind || projection.elapsedMinutes <= 0) {
    return;
  }

  totals.totalMinutes += projection.elapsedMinutes;
  if (isFulfilledKind(projection.elapsedKind)) {
    totals.fulfilledMinutes += projection.elapsedMinutes;
  } else if (projection.elapsedKind === "externalShift") {
    totals.externalShiftMinutes += projection.elapsedMinutes;
  } else if (projection.elapsedKind === "internalShift") {
    totals.internalShiftMinutes += projection.elapsedMinutes;
  }
}

function unchangedProjection(entry: ThreadHistoryEntry): HistoryProjection {
  return {
    entries: [entry],
    elapsedMinutes: 0,
    elapsedKind: null
  };
}

function fulfilledKind(kind: string): string {
  return fulfilledKindByPlanKind[kind] ?? kind;
}

function isFulfilledKind(kind: string): boolean {
  return kind === "idealFulfilled" || kind === "leisureFulfilled" || kind === "restFulfilled";
}

function mergeAdjacentHistoryEntries(entries: ThreadHistoryEntry[]): ThreadHistoryEntry[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  const merged: ThreadHistoryEntry[] = [];

  for (const entry of sorted) {
    const previous = merged.at(-1);
    if (!previous || !canMergeHistoryEntries(previous, entry)) {
      merged.push({ ...entry });
      continue;
    }

    previous.endAt =
      new Date(entry.endAt).getTime() > new Date(previous.endAt).getTime()
        ? entry.endAt
        : previous.endAt;
    previous.minutes += entry.minutes;
  }

  return merged;
}

function canMergeHistoryEntries(a: ThreadHistoryEntry, b: ThreadHistoryEntry): boolean {
  if (a.source !== b.source || a.kind !== b.kind || a.title !== b.title) {
    return false;
  }

  const aEndMs = new Date(a.endAt).getTime();
  const bStartMs = new Date(b.startAt).getTime();
  return Number.isFinite(aEndMs) && Number.isFinite(bStartMs) && aEndMs === bStartMs;
}

function minutesBetween(startAt: Date, endAt: Date): number {
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / MS_PER_MINUTE);
}

function dailyRequired(
  unscheduledGapMinutes: number,
  start: string,
  deadline: string,
  runtimeNow: Date,
  timezone: string
): number | null {
  const effectiveStart = [localDayKey(runtimeNow, timezone), start].sort().at(-1)!;
  const daysLeft = inclusiveDaysBetween(effectiveStart, deadline);
  return daysLeft > 0 ? unscheduledGapMinutes / daysLeft : null;
}

function projectedStatus(input: {
  previousStatus: Thread["status"];
  activityState: Thread["activityState"];
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  dailyRequiredMinutes: number | null;
  start: string;
  deadline: string | null;
  lastActivityAt: string | null;
  runtimeNow: Date;
  timezone: string;
  staleDays: number;
}): Thread["status"] {
  if (input.previousStatus === "fulfilled") {
    return "fulfilled";
  }
  if (localDayKey(input.runtimeNow, input.timezone) < input.start) {
    return "upcoming";
  }
  if (
    input.deadline &&
    input.factGapMinutes !== null &&
    input.factGapMinutes > 0 &&
    input.deadline < localDayKey(input.runtimeNow, input.timezone)
  ) {
    return "expired";
  }
  if (
    input.activityState === "active" &&
    isStale(
      input.lastActivityAt
        ? localDayKey(new Date(input.lastActivityAt), input.timezone)
        : input.start,
      input.runtimeNow,
      input.timezone,
      input.staleDays
    )
  ) {
    return "stale";
  }
  if (input.factGapMinutes === null || input.unscheduledGapMinutes === null) {
    return "untracked";
  }
  if (input.factGapMinutes === 0 || input.unscheduledGapMinutes === 0) {
    return "scheduled";
  }
  return input.previousStatus === "imbalanced" || input.previousStatus === "tightPace"
    ? input.previousStatus
    : "needsScheduling";
}

function latestFactActivityAt(history: ThreadHistoryEntry[]): string | null {
  return history
    .filter((entry) => entry.source === "fact")
    .map((entry) => entry.endAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function isStale(
  referenceDay: string | null,
  runtimeNow: Date,
  timezone: string,
  staleDays: number
): boolean {
  if (!referenceDay || !Number.isFinite(staleDays) || staleDays < 1) {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDay)) {
    return false;
  }
  return dayDifference(referenceDay, localDayKey(runtimeNow, timezone)) >= staleDays;
}

function inclusiveDaysBetween(start: string, end: string): number {
  const difference = dayDifference(start, end);
  return difference < 0 ? 0 : difference + 1;
}

function dayDifference(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((endMs - startMs) / MS_PER_DAY);
}

function localDayKey(date: Date, timezone: string): string {
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
    // Keep projection resilient to invalid persisted timezones.
  }

  return date.toISOString().slice(0, 10);
}
