import { calendarDayDifference, localDayKey } from "./time";
import type { FeasibilityStatus, ThreadView } from "./types";

export function deriveThreadActivityState(input: {
  current: ThreadView["activityState"];
  lastActivityAt: string | null;
  deadline: string | null;
  now: Date;
  timezone: string;
  staleDays: number;
}): ThreadView["activityState"] {
  if (input.current === "untracked" || !input.lastActivityAt || input.staleDays < 1) {
    return input.current;
  }
  const lastActivityDay = localDayKey(new Date(input.lastActivityAt), input.timezone);
  const referenceDay = input.deadline && input.deadline > lastActivityDay
    ? input.deadline
    : lastActivityDay;
  return calendarDayDifference(referenceDay, localDayKey(input.now, input.timezone)) > input.staleDays
    ? "inactive"
    : "active";
}

export function deriveThreadStatus(input: {
  previousStatus?: FeasibilityStatus;
  activityState?: ThreadView["activityState"];
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  dailyRequiredMinutes: number | null;
  start: string | null;
  deadline: string | null;
  lastActivityAt?: string | null;
  now: Date;
  timezone: string;
  staleDays?: number;
  recentDailyCapacity: number;
}): FeasibilityStatus {
  if (input.activityState === "inactive") return "untracked";
  const today = localDayKey(input.now, input.timezone);
  if (input.start && today < input.start) return "upcoming";
  if (
    input.activityState === "active" &&
    input.deadline !== null &&
    input.staleDays !== undefined &&
    isStale(input.lastActivityAt ?? input.start, input.now, input.timezone, input.staleDays)
  ) {
    return "stale";
  }
  if (input.deadline && input.deadline < today) return "expired";
  if (input.factGapMinutes === null || input.unscheduledGapMinutes === null) return "untracked";
  if (input.factGapMinutes === 0) return "scheduled";
  if (input.unscheduledGapMinutes === 0) return "scheduled";
  if (input.dailyRequiredMinutes !== null && input.recentDailyCapacity > 0) {
    if (input.dailyRequiredMinutes > input.recentDailyCapacity) return "imbalanced";
    if (input.dailyRequiredMinutes > input.recentDailyCapacity * 0.7) return "tightPace";
  }
  if (input.previousStatus === "imbalanced" || input.previousStatus === "tightPace") {
    return input.previousStatus;
  }
  return "needsScheduling";
}

function isStale(reference: string | null, now: Date, timezone: string, staleDays: number): boolean {
  if (!reference || !Number.isFinite(staleDays) || staleDays < 1) return false;
  const referenceDay = /^\d{4}-\d{2}-\d{2}$/.test(reference)
    ? reference
    : localDayKey(new Date(reference), timezone);
  return calendarDayDifference(referenceDay, localDayKey(now, timezone)) >= staleDays;
}
