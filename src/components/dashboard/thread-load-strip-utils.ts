import type { DashboardData } from "@/server/services/dashboard-service";

type Thread = DashboardData["view"]["threads"][number];

export interface ThreadLoadContribution {
  key: string;
  label: string;
  dailyMinutes: number;
}

export interface ThreadLoadSegment {
  start: string;
  end: string;
  days: number;
  dailyMinutes: number;
  contributions: ThreadLoadContribution[];
}

const MS_PER_DAY = 86_400_000;

export function buildThreadLoadSegments(
  threads: DashboardData["view"]["threads"],
  today: string
): ThreadLoadSegment[] {
  const loads = threads.flatMap((thread) => threadLoad(thread, today));
  if (loads.length === 0) return [];

  const lastEnd = loads.map((load) => load.endExclusive).sort().at(-1)!;
  const boundaries = [...new Set([today, lastEnd, ...loads.flatMap((load) => [load.start, load.endExclusive])])]
    .filter((date) => date >= today && date <= lastEnd)
    .sort();

  return boundaries.slice(0, -1).map((start, index) => {
    const endExclusive = boundaries[index + 1]!;
    const contributions = loads
      .filter((load) => load.start <= start && start < load.endExclusive)
      .map(({ endExclusive: _endExclusive, start: _start, ...load }) => load)
      .sort((a, b) => b.dailyMinutes - a.dailyMinutes);

    return {
      start,
      end: addDays(endExclusive, -1),
      days: daysBetween(start, endExclusive),
      dailyMinutes: contributions.reduce((sum, item) => sum + item.dailyMinutes, 0),
      contributions
    };
  });
}

function threadLoad(thread: Thread, today: string) {
  if (
    (thread.activityState ?? "active") !== "active" ||
    thread.source === "untracked" ||
    thread.factGapMinutes === null ||
    thread.factGapMinutes <= 0 ||
    !thread.deadline ||
    thread.deadline < today
  ) {
    return [];
  }

  const start = [today, thread.start ?? today].sort().at(-1)!;
  if (start > thread.deadline) return [];

  const days = daysBetween(start, addDays(thread.deadline, 1));
  return [{
    key: thread.key,
    label: `${thread.group}：${thread.item}`,
    dailyMinutes: thread.factGapMinutes / days,
    start,
    endExclusive: addDays(thread.deadline, 1)
  }];
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, endExclusive: string): number {
  return Math.round(
    (Date.parse(`${endExclusive}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / MS_PER_DAY
  );
}
