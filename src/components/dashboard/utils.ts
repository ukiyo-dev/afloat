import { DashboardData } from "@/server/services/dashboard-service";

export function groupThreads(threads: DashboardData["view"]["threads"]) {
  const byGroup = new Map<string, DashboardData["view"]["threads"]>();
  for (const thread of threads) {
    byGroup.set(thread.group, [...(byGroup.get(thread.group) ?? []), thread]);
  }

  return [...byGroup.entries()].map(([group, items]) => {
    const expectedValues = items
      .map((item) => item.expectedMinutes)
      .filter((value): value is number => value !== null);
    const expectedMinutes =
      expectedValues.length > 0 ? expectedValues.reduce((total, value) => total + value, 0) : null;
    const fulfilledMinutes = sum(items.map((item) => item.fulfilledMinutes));
    const futureMinutes = sum(items.map((item) => item.futureMinutes));
    const factGapMinutes = sumNullable(items.map((item) => item.factGapMinutes));
    const unscheduledGapMinutes = sumNullable(items.map((item) => item.unscheduledGapMinutes));
    const coveredFutureMinutes = sum(
      items.map((item) =>
        item.factGapMinutes === null ? 0 : Math.min(item.futureMinutes, item.factGapMinutes)
      )
    );
    const planCoverageRate =
      factGapMinutes === null || factGapMinutes === 0 ? null : coveredFutureMinutes / factGapMinutes;

    return {
      key: encodeURIComponent(group),
      group,
      expectedMinutes,
      deadline:
        items
          .map((item) => item.deadline)
          .filter((deadline): deadline is string => deadline !== null)
          .sort((a, b) => b.localeCompare(a))[0] ?? null,
      fulfilledMinutes,
      futureMinutes,
      externalShiftMinutes: sum(items.map((item) => item.externalShiftMinutes)),
      internalShiftMinutes: sum(items.map((item) => item.internalShiftMinutes)),
      factGapMinutes,
      unscheduledGapMinutes,
      planCoverageRate,
      dailyRequiredMinutes: null,
      status: items[0]?.status ?? "untracked",
      items
    };
  });
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumNullable(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value !== null);
  return numericValues.length > 0 ? sum(numericValues) : null;
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
    both: "主动+自动"
  };
  return labels[source] ?? source;
}

export function todayKey(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // fallback if timezone is somehow invalid
  }
  return new Date().toISOString().slice(0, 10);
}

export function dayHref(basePath: string, date: string) {
  return `${basePath}?range=day&date=${date}`;
}

export function addLocalDaysKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
