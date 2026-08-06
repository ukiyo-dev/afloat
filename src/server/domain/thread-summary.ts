import type { FeasibilityStatus, ThreadView } from "./types";

export interface ThreadScheduleEntry {
  start?: string | null;
  deadline: string | null;
  status: FeasibilityStatus;
}

export interface ThreadGroupSummary {
  commitmentItems: ThreadView[];
  expectedMinutes: number | null;
  start: string | null;
  deadline: string | null;
  fulfilledMinutes: number;
  futureMinutes: number;
  externalShiftMinutes: number;
  internalShiftMinutes: number;
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  planCoverageRate: number | null;
  dailyRequiredMinutes: number | null;
  allItemsInactive: boolean;
}

export function summarizeThreadGroup(items: ThreadView[]): ThreadGroupSummary {
  const commitmentItems = items.filter((item) => item.activityState !== "untracked");
  const expectedValues = commitmentItems
    .map((item) => item.expectedMinutes)
    .filter((value): value is number => value !== null);
  const factGapMinutes = sumNullable(commitmentItems.map((item) => item.factGapMinutes));
  const coveredFutureMinutes = sum(
    commitmentItems.map((item) =>
      item.factGapMinutes === null ? 0 : Math.min(item.futureMinutes, item.factGapMinutes)
    )
  );

  return {
    commitmentItems,
    expectedMinutes: expectedValues.length > 0 ? sum(expectedValues) : null,
    start: earliestStart(
      commitmentItems.map((item) => item.start).filter((value): value is string => Boolean(value))
    ),
    deadline: latestDeadline(commitmentItems.map((item) => item.deadline)),
    fulfilledMinutes: sum(items.map((item) => item.fulfilledMinutes)),
    futureMinutes: sum(items.map((item) => item.futureMinutes)),
    externalShiftMinutes: sum(items.map((item) => item.externalShiftMinutes)),
    internalShiftMinutes: sum(items.map((item) => item.internalShiftMinutes)),
    factGapMinutes,
    unscheduledGapMinutes: sumNullable(commitmentItems.map((item) => item.unscheduledGapMinutes)),
    planCoverageRate:
      factGapMinutes === null || factGapMinutes === 0
        ? null
        : coveredFutureMinutes / factGapMinutes,
    dailyRequiredMinutes: sumNullable(commitmentItems.map((item) => item.dailyRequiredMinutes)),
    allItemsInactive: items.every(
      (item) => item.activityState === "inactive" || item.activityState === "untracked"
    )
  };
}

export function threadIdentityKey(group: string, item: string): string {
  return `${group}\u0000${item}`;
}

export function earliestStart(starts: string[]): string | null {
  return [...starts].sort((a, b) => a.localeCompare(b))[0] ?? null;
}

export function latestDeadline(deadlines: Array<string | null>): string | null {
  return deadlines
    .filter((deadline): deadline is string => deadline !== null)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function sumNullable(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value !== null);
  return numericValues.length > 0 ? sum(numericValues) : null;
}

export function statusRank(status: FeasibilityStatus): number {
  const ranks: Record<FeasibilityStatus, number> = {
    expired: 0,
    stale: 1,
    imbalanced: 2,
    tightPace: 3,
    needsScheduling: 4,
    scheduled: 5,
    fulfilled: 6,
    untracked: 7,
    upcoming: 8
  };
  return ranks[status] ?? 8;
}

export function startRank(start: string | null | undefined): number {
  return start ? Date.parse(`${start}T00:00:00.000Z`) : Number.POSITIVE_INFINITY;
}

export function deadlineRank(deadline: string | null): number {
  return deadline ? Date.parse(`${deadline}T00:00:00.000Z`) : Number.POSITIVE_INFINITY;
}

export function compareActiveThreadSchedule(
  a: ThreadScheduleEntry,
  b: ThreadScheduleEntry
): number {
  const upcomingOrder = Number(a.status === "upcoming") - Number(b.status === "upcoming");
  if (upcomingOrder !== 0) return upcomingOrder;

  if (a.status === "upcoming" && b.status === "upcoming") {
    return (
      startRank(a.start) - startRank(b.start) ||
      statusRank(a.status) - statusRank(b.status) ||
      deadlineRank(a.deadline) - deadlineRank(b.deadline)
    );
  }

  const deadlinePresenceOrder = Number(a.deadline === null) - Number(b.deadline === null);
  if (deadlinePresenceOrder !== 0) return deadlinePresenceOrder;
  if (a.deadline && b.deadline) {
    return (
      deadlineRank(a.deadline) - deadlineRank(b.deadline) ||
      statusRank(a.status) - statusRank(b.status) ||
      startRank(a.start) - startRank(b.start)
    );
  }
  return startRank(a.start) - startRank(b.start) || statusRank(a.status) - statusRank(b.status);
}

export function highestRiskStatus(statuses: FeasibilityStatus[]): FeasibilityStatus {
  return [...statuses].sort((a, b) => statusRank(a) - statusRank(b))[0] ?? "untracked";
}
