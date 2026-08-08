import { addDateKeyDays, inclusiveCalendarDays, localDayKey } from "@/server/domain/time";
import { DashboardData } from "@/server/services/dashboard-service";

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

export function todayKey(timezone: string, now: Date) {
  return localDayKey(now, timezone);
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
