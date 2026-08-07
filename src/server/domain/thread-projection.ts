import type { ThreadView } from "@/server/domain/types";
import {
  inclusiveCalendarDays,
  localDayKey,
  minutesBetween
} from "@/server/domain/time";
import {
  fulfilledKindByPlanKind,
  isFulfilledKind,
  isPlanKind
} from "@/server/domain/semantic-kinds";
import { deriveThreadActivityState, deriveThreadStatus } from "@/server/domain/thread-status";
import type { ThreadActivityAttribution } from "@/server/views/derived-view";

import { buildThreadGroupViews } from "@/server/domain/threads";

type Thread = ThreadView;
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
export function projectThreadsForNow(
  threads: ThreadView[],
  runtimeNowIso: string,
  timezone: string,
  baseNowIso: string,
  staleDays = 7,
  recentDailyCapacity = 0
): ThreadView[] {
  const baseNow = new Date(baseNowIso);
  const runtimeNow = new Date(runtimeNowIso);
  if (Number.isNaN(baseNow.getTime()) || Number.isNaN(runtimeNow.getTime())) {
    return threads;
  }

  const minuteRuntimeNow = floorToMinute(runtimeNow);
  const projectionNow = minuteRuntimeNow > baseNow ? minuteRuntimeNow : baseNow;
  return threads.map((thread) => projectThreadForNow(
    thread,
    baseNow,
    projectionNow,
    timezone,
    staleDays,
    recentDailyCapacity
  ));
}

function floorToMinute(value: Date): Date {
  return new Date(Math.floor(value.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE);
}

export function projectThreadDerivedViewForNow(
  threads: ThreadView[],
  runtimeNowIso: string,
  timezone: string,
  baseNowIso: string,
  staleDays = 7,
  recentDailyCapacity = 0
) {
  const projectedThreads = projectThreadsForNow(
    threads,
    runtimeNowIso,
    timezone,
    baseNowIso,
    staleDays,
    recentDailyCapacity
  );
  const threadActivityAttributions: ThreadActivityAttribution[] = projectedThreads.flatMap((thread) =>
    thread.history.map((entry) => ({
      startAt: entry.startAt,
      endAt: entry.endAt,
      source: entry.source,
      sourceEventId: entry.sourceEventId ?? null,
      planEventId: entry.planEventId ?? null,
      kind: entry.kind,
      title: entry.title,
      threadGroup: thread.group,
      threadItem: thread.item
    }))
  );
  return {
    threads: projectedThreads,
    threadGroups: buildThreadGroupViews(projectedThreads),
    threadActivityAttributions
  };
}

function projectThreadForNow(
  thread: Thread,
  baseNow: Date,
  runtimeNow: Date,
  timezone: string,
  staleDays: number,
  recentDailyCapacity: number
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
      ? inclusiveCalendarDays(
        [localDayKey(runtimeNow, timezone), thread.start ?? localDayKey(runtimeNow, timezone)]
          .sort()
          .at(-1)!,
        thread.deadline
      )
    : null;
  const sortedHistory = history.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  const lastActivityAt = latestFactActivityAt(sortedHistory) ?? thread.lastActivityAt ?? null;
  const activityState = deriveThreadActivityState({
    current: thread.activityState ?? "active",
    lastActivityAt,
    deadline: thread.deadline,
    now: runtimeNow,
    timezone,
    staleDays
  });

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
    status: deriveThreadStatus({
      previousStatus: thread.status,
      activityState,
      factGapMinutes,
      unscheduledGapMinutes,
      dailyRequiredMinutes,
      start: thread.start ?? localDayKey(runtimeNow, timezone),
      deadline: thread.deadline,
      lastActivityAt,
      now: runtimeNow,
      timezone,
      staleDays,
      recentDailyCapacity
    }),
    activityState,
    closed: activityState === "inactive",
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
  return isPlanKind(kind) ? fulfilledKindByPlanKind[kind] : kind;
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
  if (
    a.source !== b.source ||
    a.kind !== b.kind ||
    a.title !== b.title ||
    a.threadInstance !== b.threadInstance ||
    a.activitySequence !== b.activitySequence
  ) {
    return false;
  }

  const aEndMs = new Date(a.endAt).getTime();
  const bStartMs = new Date(b.startAt).getTime();
  return Number.isFinite(aEndMs) && Number.isFinite(bStartMs) && aEndMs === bStartMs;
}

function dailyRequired(
  unscheduledGapMinutes: number,
  start: string,
  deadline: string,
  runtimeNow: Date,
  timezone: string
): number | null {
  const effectiveStart = [localDayKey(runtimeNow, timezone), start].sort().at(-1)!;
  const daysLeft = inclusiveCalendarDays(effectiveStart, deadline);
  return daysLeft > 0 ? unscheduledGapMinutes / daysLeft : null;
}

function latestFactActivityAt(history: ThreadHistoryEntry[]): string | null {
  return history
    .filter((entry) => entry.source === "fact")
    .map((entry) => entry.endAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}
