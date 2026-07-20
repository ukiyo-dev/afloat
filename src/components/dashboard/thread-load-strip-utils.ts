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
  originalDailyMinutes: number;
  fixedDailyMinutes: number;
  contributions: ThreadLoadContribution[];
}

interface LoadItem {
  key: string;
  label: string;
  minutes: number;
  startIndex: number;
  endIndex: number;
  fixedDailyMinutes: number | null;
}

const MS_PER_DAY = 86_400_000;
const EPSILON = 0.001;

export function buildThreadLoadSegments(
  threads: DashboardData["view"]["threads"],
  today: string
): ThreadLoadSegment[] {
  const eligible = threads.filter((thread) => isEligible(thread, today));
  if (eligible.length === 0) return [];

  const lastDay = eligible.map((thread) => thread.deadline!).sort().at(-1)!;
  const dates = dayKeys(today, lastDay);
  const items = eligible.map((thread) => toLoadItem(thread, today, dates));
  const fixed = Array(dates.length).fill(0) as number[];
  const allocations = new Map<string, number[]>();
  const originalAllocations = new Map<string, number[]>();

  for (const item of items) {
    const allocation = Array(dates.length).fill(0) as number[];
    if (item.fixedDailyMinutes !== null) {
      for (let day = item.startIndex; day <= item.endIndex; day += 1) {
        allocation[day] = item.fixedDailyMinutes;
        fixed[day] += item.fixedDailyMinutes;
      }
    } else {
      const daily = item.minutes / (item.endIndex - item.startIndex + 1);
      for (let day = item.startIndex; day <= item.endIndex; day += 1) allocation[day] = daily;
    }
    allocations.set(item.key, [...allocation]);
    originalAllocations.set(item.key, allocation);
  }

  levelFlexibleLoads(items, allocations, fixed);

  const days = dates.map((date, day) => {
    const contributions = items
      .map((item) => ({ key: item.key, label: item.label, dailyMinutes: allocations.get(item.key)![day]! }))
      .filter((item) => item.dailyMinutes > EPSILON)
      .sort((a, b) => b.dailyMinutes - a.dailyMinutes);
    const originalDailyMinutes = items.reduce(
      (sum, item) => sum + originalAllocations.get(item.key)![day]!, 0
    );
    return {
      start: date,
      end: date,
      days: 1,
      dailyMinutes: contributions.reduce((sum, item) => sum + item.dailyMinutes, 0),
      originalDailyMinutes,
      fixedDailyMinutes: fixed[day]!,
      contributions
    };
  });

  return compressDays(days);
}

function levelFlexibleLoads(items: LoadItem[], allocations: Map<string, number[]>, fixed: number[]): void {
  const flexible = items.filter((item) => item.fixedDailyMinutes === null);
  if (flexible.length === 0) return;

  const totals = [...fixed];
  for (const item of flexible) addInto(totals, allocations.get(item.key)!, 1);

  for (let iteration = 0; iteration < 100; iteration += 1) {
    let largestChange = 0;
    for (const item of flexible) {
      const previous = allocations.get(item.key)!;
      addInto(totals, previous, -1);
      const next = waterFill(totals, item.startIndex, item.endIndex, item.minutes);
      for (let day = item.startIndex; day <= item.endIndex; day += 1) {
        largestChange = Math.max(largestChange, Math.abs(next[day]! - previous[day]!));
      }
      allocations.set(item.key, next);
      addInto(totals, next, 1);
    }
    if (largestChange < EPSILON) break;
  }
}

function waterFill(base: number[], start: number, end: number, minutes: number): number[] {
  const result = Array(base.length).fill(0) as number[];
  const candidates = Array.from({ length: end - start + 1 }, (_, offset) => start + offset)
    .sort((a, b) => base[a]! - base[b]! || a - b);
  let remaining = minutes;

  for (let count = 1; count <= candidates.length; count += 1) {
    const current = base[candidates[count - 1]!]!;
    const next = count < candidates.length ? base[candidates[count]!]! : Number.POSITIVE_INFINITY;
    const required = (next - current) * count;
    if (remaining <= required || count === candidates.length) {
      const level = current + remaining / count;
      for (let index = 0; index < count; index += 1) {
        const day = candidates[index]!;
        result[day] = Math.max(0, level - base[day]!);
      }
      return result;
    }
    remaining -= required;
  }
  return result;
}

function isEligible(thread: Thread, today: string): boolean {
  if ((thread.activityState ?? "active") !== "active" || thread.source === "untracked" || !thread.deadline || thread.deadline < today) return false;
  if ([today, thread.start ?? today].sort().at(-1)! > thread.deadline) return false;
  if (thread.declaredDailyMinutes !== null && thread.declaredDailyMinutes !== undefined) return thread.declaredDailyMinutes > 0;
  return thread.factGapMinutes !== null && thread.factGapMinutes > 0;
}

function toLoadItem(thread: Thread, today: string, dates: string[]): LoadItem {
  const start = [today, thread.start ?? today].sort().at(-1)!;
  return {
    key: thread.key,
    label: `${thread.group}：${thread.item}`,
    minutes: thread.factGapMinutes ?? 0,
    startIndex: dates.indexOf(start),
    endIndex: dates.indexOf(thread.deadline!),
    fixedDailyMinutes: thread.declaredDailyMinutes ?? null
  };
}

function compressDays(days: ThreadLoadSegment[]): ThreadLoadSegment[] {
  const segments: ThreadLoadSegment[] = [];
  for (const day of days) {
    const previous = segments.at(-1);
    if (previous && sameLoad(previous, day)) {
      previous.end = day.end;
      previous.days += 1;
    } else {
      segments.push({ ...day, contributions: day.contributions.map((item) => ({ ...item })) });
    }
  }
  return segments;
}

function sameLoad(a: ThreadLoadSegment, b: ThreadLoadSegment): boolean {
  if (Math.abs(a.dailyMinutes - b.dailyMinutes) > EPSILON || Math.abs(a.originalDailyMinutes - b.originalDailyMinutes) > EPSILON || a.contributions.length !== b.contributions.length) return false;
  return a.contributions.every((item, index) => item.key === b.contributions[index]?.key && Math.abs(item.dailyMinutes - b.contributions[index]!.dailyMinutes) <= EPSILON);
}

function addInto(total: number[], allocation: number[], direction: 1 | -1): void {
  for (let index = 0; index < total.length; index += 1) total[index] += allocation[index]! * direction;
}

function dayKeys(start: string, end: string): string[] {
  const result: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) result.push(day);
  return result;
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
