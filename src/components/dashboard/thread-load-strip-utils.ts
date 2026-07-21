import type { DashboardData } from "@/server/services/dashboard-service";
import { localDayKey } from "@/server/domain/time";

type Thread = DashboardData["view"]["threads"][number];

export interface ThreadLoadContribution {
  key: string;
  label: string;
  dailyMinutes: number;
}

export interface DisplayThreadLoadContribution extends ThreadLoadContribution {
  displayMinutes: number;
}

export interface ThreadLoadSegment {
  start: string;
  end: string;
  days: number;
  dailyMinutes: number;
  originalDailyMinutes: number;
  steadyDailyMinutes: number;
  contributions: ThreadLoadContribution[];
}

interface LoadItem {
  key: string;
  label: string;
  minutes: number;
  openingMinutes: number;
  startIndex: number;
  endIndex: number;
  steady: boolean;
  todayMinutes: number;
  todayDebtMinutes: number;
  todayPaceRatio: number;
  todayFactMinutes: number;
}

const MS_PER_DAY = 86_400_000;
const EPSILON = 0.001;

export function buildThreadLoadSegments(
  threads: DashboardData["view"]["threads"],
  today: string,
  timezone = "UTC"
): ThreadLoadSegment[] {
  const eligible = threads.filter((thread) => isEligible(thread, today));
  if (eligible.length === 0) return [];

  const lastDay = eligible.map((thread) => thread.deadline!).sort().at(-1)!;
  const dates = dayKeys(today, lastDay);
  const items = eligible.map((thread) => toLoadItem(thread, today, dates, timezone));
  const baselineToday = buildBaselineToday(items, dates.length);
  allocateToday(items, baselineToday.allocations, baselineToday.budget);
  const steadyBase = Array(dates.length).fill(0) as number[];
  const allocations = new Map<string, number[]>();
  const originalAllocations = new Map<string, number[]>();

  for (const item of items) {
    const allocation = Array(dates.length).fill(0) as number[];
    if (item.startIndex === 0) allocation[0] = item.todayMinutes;
    const futureStart = Math.max(1, item.startIndex);
    const futureMinutes = item.minutes - Math.max(0, item.todayMinutes);
    if (item.steady) {
      const futureDays = item.endIndex - futureStart + 1;
      const daily = futureDays > 0 ? futureMinutes / futureDays : 0;
      steadyBase[0] += Math.max(0, allocation[0]!);
      for (let day = futureStart; day <= item.endIndex; day += 1) {
        allocation[day] = daily;
        steadyBase[day] += daily;
      }
    } else {
      const futureDays = item.endIndex - futureStart + 1;
      const daily = futureDays > 0 ? futureMinutes / futureDays : 0;
      for (let day = futureStart; day <= item.endIndex; day += 1) allocation[day] = daily;
    }
    allocations.set(item.key, [...allocation]);
    originalAllocations.set(item.key, allocation);
  }

  levelFlexibleLoads(items, allocations, steadyBase);

  const days = dates.map((date, day) => {
    const contributions = items
      .map((item) => ({ key: item.key, label: item.label, dailyMinutes: allocations.get(item.key)![day]! }))
      .filter((item) => day === 0 ? Math.abs(item.dailyMinutes) > EPSILON : item.dailyMinutes > EPSILON)
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
      steadyDailyMinutes: steadyBase[day]!,
      contributions
    };
  });

  return compressDays(days);
}

function levelFlexibleLoads(items: LoadItem[], allocations: Map<string, number[]>, steadyBase: number[]): void {
  const cohorts = groupFlexibleItems(items).sort((a, b) =>
    windowDays(a[0]!) - windowDays(b[0]!) ||
    a[0]!.endIndex - b[0]!.endIndex ||
    a[0]!.startIndex - b[0]!.startIndex
  );
  if (cohorts.length === 0) return;

  const totals = [...steadyBase];
  for (const item of items.filter((candidate) => !candidate.steady)) {
    totals[0] += Math.max(0, allocations.get(item.key)?.[0] ?? 0);
  }
  for (const cohort of cohorts) {
    const first = cohort[0]!;
    const cohortMinutes = cohort.reduce(
      (sum, item) => sum + item.minutes - Math.max(0, item.todayMinutes),
      0
    );
    const cohortStart = Math.max(1, first.startIndex);
    const cohortAllocation = cohortStart <= first.endIndex
      ? waterFill(totals, cohortStart, first.endIndex, cohortMinutes)
      : Array(totals.length).fill(0) as number[];

    for (const item of cohort) {
      const itemFutureMinutes = item.minutes - Math.max(0, item.todayMinutes);
      const share = cohortMinutes === 0 ? 0 : itemFutureMinutes / cohortMinutes;
      const allocation = cohortAllocation.map((minutes) => minutes * share);
      allocation[0] = item.todayMinutes;
      allocations.set(item.key, allocation);
    }
    addInto(totals, cohortAllocation, 1);
  }
}

function groupFlexibleItems(items: LoadItem[]): LoadItem[][] {
  const cohorts = new Map<string, LoadItem[]>();
  for (const item of items.filter((candidate) => !candidate.steady)) {
    const key = `${item.startIndex}:${item.endIndex}`;
    const cohort = cohorts.get(key) ?? [];
    cohort.push(item);
    cohorts.set(key, cohort);
  }
  return [...cohorts.values()].map((cohort) => cohort.sort((a, b) => a.key.localeCompare(b.key)));
}

function windowDays(item: LoadItem): number {
  return item.endIndex - item.startIndex + 1;
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
  return thread.factGapMinutes !== null && thread.factGapMinutes > 0;
}

function toLoadItem(thread: Thread, today: string, dates: string[], timezone: string): LoadItem {
  const start = [today, thread.start ?? today].sort().at(-1)!;
  const minutes = thread.factGapMinutes ?? 0;
  const todayFactMinutes = thread.history
    .filter((entry) => entry.source === "fact" && localDayKey(new Date(entry.startAt), timezone) === today)
    .reduce((sum, entry) => sum + entry.minutes, 0);
  return {
    key: thread.key,
    label: `${thread.group}：${thread.item}`,
    minutes,
    openingMinutes: minutes + todayFactMinutes,
    startIndex: dates.indexOf(start),
    endIndex: dates.indexOf(thread.deadline!),
    steady: thread.steadyDaily ?? false,
    todayMinutes: 0,
    todayFactMinutes,
    ...todayPace(thread, start === today ? today : null, todayFactMinutes)
  };
}

function todayPace(
  thread: Thread,
  today: string | null,
  todayFactMinutes: number
): Pick<LoadItem, "todayDebtMinutes" | "todayPaceRatio"> {
  if (today === null || thread.expectedMinutes === null || !thread.deadline) {
    return { todayDebtMinutes: 0, todayPaceRatio: 0 };
  }
  const start = thread.start ?? today;
  const totalDays = dayKeys(start, thread.deadline).length;
  const elapsedDays = Math.min(totalDays, dayKeys(start, today).length);
  const cumulativeTarget = thread.expectedMinutes * elapsedDays / totalDays;
  const fulfilledBeforeToday = Math.max(0, thread.fulfilledMinutes - todayFactMinutes);
  const openingGap = (thread.factGapMinutes ?? 0) + todayFactMinutes;
  const debt = Math.min(openingGap, Math.max(0, cumulativeTarget - fulfilledBeforeToday));
  return {
    todayDebtMinutes: debt,
    todayPaceRatio: cumulativeTarget > 0 ? debt / cumulativeTarget : 0
  };
}

function buildBaselineToday(
  items: LoadItem[],
  dateCount: number
): { budget: number; allocations: Map<string, number> } {
  const totals = Array(dateCount).fill(0) as number[];
  const allocations = new Map(items.map((item) => [item.key, 0]));
  const flexible = items.filter((item) => !item.steady);

  for (const item of items.filter((candidate) => candidate.steady)) {
    const daily = item.openingMinutes / windowDays(item);
    for (let day = item.startIndex; day <= item.endIndex; day += 1) totals[day] += daily;
    if (item.startIndex === 0) allocations.set(item.key, daily);
  }

  const cohorts = groupFlexibleItems(flexible).sort((a, b) =>
    windowDays(a[0]!) - windowDays(b[0]!) ||
    a[0]!.endIndex - b[0]!.endIndex ||
    a[0]!.startIndex - b[0]!.startIndex
  );
  for (const cohort of cohorts) {
    const first = cohort[0]!;
    const allocation = waterFill(
      totals,
      first.startIndex,
      first.endIndex,
      cohort.reduce((sum, item) => sum + item.openingMinutes, 0)
    );
    const cohortMinutes = cohort.reduce((sum, item) => sum + item.openingMinutes, 0);
    for (const item of cohort) {
      if (item.startIndex === 0) {
        allocations.set(item.key, allocation[0]! * item.openingMinutes / cohortMinutes);
      }
    }
    addInto(totals, allocation, 1);
  }
  return { budget: totals[0] ?? 0, allocations };
}

function allocateToday(items: LoadItem[], baseline: Map<string, number>, budget: number): void {
  const candidates = items.filter((item) => item.startIndex === 0 && item.todayDebtMinutes > EPSILON);
  const weights = candidates.map((item) => ({
    item,
    weight: (baseline.get(item.key) ?? 0) * item.todayPaceRatio
  }));
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const totalDebt = candidates.reduce((sum, item) => sum + item.todayDebtMinutes, 0);
  const allocation = Math.min(budget, totalDebt);
  if (allocation <= EPSILON) return;

  for (const { item, weight } of weights) {
    const openingAllocation = totalWeight > EPSILON
      ? allocation * weight / totalWeight
      : allocation * item.todayDebtMinutes / totalDebt;
    item.todayMinutes = openingAllocation - item.todayFactMinutes;
  }
}

function compressDays(days: ThreadLoadSegment[]): ThreadLoadSegment[] {
  const segments: ThreadLoadSegment[] = [];
  for (const day of days) {
    const previous = segments.at(-1);
    if (previous && previous.start !== days[0]?.start && sameLoad(previous, day)) {
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

export function apportionDisplayMinutes(
  contributions: ThreadLoadContribution[],
  totalMinutes: number
): DisplayThreadLoadContribution[] {
  const apportioned = contributions.map((item) => ({
    ...item,
    displayMinutes: Math.floor(item.dailyMinutes),
    remainder: item.dailyMinutes - Math.floor(item.dailyMinutes)
  }));
  let remaining = Math.max(0, totalMinutes - apportioned.reduce((sum, item) => sum + item.displayMinutes, 0));

  for (const item of [...apportioned].sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key))) {
    if (remaining === 0) break;
    item.displayMinutes += 1;
    remaining -= 1;
  }

  return apportioned.map(({ remainder: _remainder, ...item }) => item);
}
