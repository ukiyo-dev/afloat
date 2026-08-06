import { addDateKeyDays, inclusiveCalendarDays, localDayKey } from "@/server/domain/time";
import {
  compareActiveThreadSchedule,
  highestRiskStatus,
  summarizeThreadGroup
} from "@/server/domain/thread-summary";
import { DashboardData } from "@/server/services/dashboard-service";

export function groupThreads(threads: DashboardData["view"]["threads"]): DashboardData["view"]["threadGroups"] {
  const byGroup = new Map<string, DashboardData["view"]["threads"]>();
  for (const thread of threads) {
    byGroup.set(thread.group, [...(byGroup.get(thread.group) ?? []), thread]);
  }

  return [...byGroup.entries()].map(([group, items]) => {
    const summary = summarizeThreadGroup(items);
    const computedStatus = highestRiskStatus(summary.commitmentItems.map((item) => item.status));

    return {
      key: encodeURIComponent(group),
      group,
      expectedMinutes: summary.expectedMinutes,
      start: summary.start,
      deadline: summary.deadline,
      fulfilledMinutes: summary.fulfilledMinutes,
      futureMinutes: summary.futureMinutes,
      externalShiftMinutes: summary.externalShiftMinutes,
      internalShiftMinutes: summary.internalShiftMinutes,
      factGapMinutes: summary.factGapMinutes,
      unscheduledGapMinutes: summary.unscheduledGapMinutes,
      planCoverageRate: summary.planCoverageRate,
      // Group-level daily pacing was intentionally omitted from this client view.
      dailyRequiredMinutes: null,
      status: computedStatus === "fulfilled" && !summary.allItemsInactive ? "untracked" : computedStatus,
      items: [...items].sort(compareActiveThreadSchedule)
    };
  }).sort(compareActiveThreadSchedule);
}

export function syncKindLabel(kind: string) {
  const labels: Record<string, string> = {
    recent: "近期",
    recalibrate: "校准"
  };
  return labels[kind] ?? kind;
}

export function syncStatusLabel(status: string) {
  const labels: Record<string, string> = {
    running: "RUNNING",
    succeeded: "OK",
    failed: "FAIL"
  };
  return labels[status] ?? status;
}

export function syncRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) {
    return "N/A";
  }
  return `${startAt.slice(5, 10)} > ${endAt.slice(5, 10)}`;
}

export function protocolErrorLabel(type: string) {
  const labels: Record<string, string> = {
    planOverlap: "计划层重叠",
    shiftOverlap: "偏移层重叠",
    sequenceRegression: "序号回退"
  };
  return labels[type] ?? type;
}

export function threadSourceLabel(source: string) {
  const labels: Record<string, string> = {
    declared: "主动",
    auto: "自动",
    both: "主动+自动",
    untracked: "不追踪"
  };
  return labels[source] ?? source;
}

export function todayKey(timezone: string) {
  return localDayKey(new Date(), timezone);
}

export function dayHref(basePath: string, date: string) {
  return `${basePath}?range=day&date=${date}`;
}

export function shiftedRangeParams(startDate: string, endDate: string, direction: -1 | 1) {
  const windowDays = inclusiveCalendarDays(startDate, endDate);

  if (windowDays === 1) {
    return {
      range: "day",
      date: addDateKeyDays(startDate, direction),
      start: null,
      end: null
    };
  }

  const offset = windowDays * direction;
  return {
    range: "custom",
    date: null,
    start: addDateKeyDays(startDate, offset),
    end: addDateKeyDays(endDate, offset)
  };
}
