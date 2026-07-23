import type { DashboardData } from "@/server/services/dashboard-service";
import { intersection, localDayRange, minutesInRange } from "@/server/domain/time";
import { solveDailyLoadByIntervals } from "@/server/domain/daily-load-solver";

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

export interface RangeDailyLoadInvestment {
  actualMinutes: number;
  averageActualMinutes: number;
  idealMinutes: number;
  rate: number | null;
}

export type DailyLoadSettlementStrategy = "curve-preservation" | "deadline-pressure";

interface LoadItem {
  key: string;
  label: string;
  openingMinutes: number;
  startIndex: number;
  endIndex: number;
  steady: boolean;
  todayFactMinutes: number;
}

const MS_PER_DAY = 86_400_000;
const EPSILON = 0.001;
const DISPLAY_EPSILON = 0.5;

export function buildThreadLoadSegments(
  threads: DashboardData["view"]["threads"],
  today: string,
  timezone = "UTC",
  settlementStrategy: DailyLoadSettlementStrategy = "deadline-pressure"
): ThreadLoadSegment[] {
  const eligible = threads.filter((thread) => isEligible(thread, today));
  if (eligible.length === 0) return [];

  const lastDay = eligible.map((thread) => thread.deadline!).sort().at(-1)!;
  const dates = dayKeys(today, lastDay);
  const items = eligible.map((thread) => toLoadItem(thread, today, dates, timezone));
  const ideal = buildIdealMatrix(eligible, today, lastDay);
  const originalAllocations = new Map(items.map((item) => [item.key, [...ideal.allocations.get(item.key)!]]));
  const allocations = new Map(items.map((item) => [item.key, [...ideal.allocations.get(item.key)!]]));
  settlePastDeviations(items, allocations, settlementStrategy);
  applyTodayFacts(items, allocations);
  const steadyBase = dates.map((_, day) => items
    .filter((item) => item.steady)
    .reduce((sum, item) => sum + Math.max(0, allocations.get(item.key)![day]!), 0));

  const days = dates.map((date, day) => {
    const contributions = items
      .map((item) => ({ key: item.key, label: item.label, dailyMinutes: cleanDisplayMinutes(allocations.get(item.key)![day]!) }))
      .filter((item) => day === 0
        ? Math.abs(item.dailyMinutes) >= DISPLAY_EPSILON
        : item.dailyMinutes >= DISPLAY_EPSILON)
      .sort((a, b) => b.dailyMinutes - a.dailyMinutes || a.key.localeCompare(b.key));
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

  return days.every((day) => day.contributions.length === 0) ? [] : compressDays(days);
}

export function calculateRangeDailyLoadInvestment(
  threads: DashboardData["view"]["threads"],
  startDate: string,
  endDate: string,
  timezone = "UTC"
): RangeDailyLoadInvestment {
  const eligible = threads.filter((thread) => isEligible(thread, startDate));
  if (eligible.length === 0) {
    return { actualMinutes: 0, averageActualMinutes: 0, idealMinutes: 0, rate: null };
  }

  const lastDay = eligible.map((thread) => thread.deadline!).sort().at(-1)!;
  const dates = dayKeys(startDate, lastDay);
  const ideal = buildIdealMatrix(eligible, startDate, lastDay);
  const idealDailyMinutes = dates.map((date, day) => {
    if (date > endDate) return 0;
    return eligible.reduce(
      (sum, thread) => sum + (ideal.allocations.get(thread.key)?.[day] ?? 0),
      0
    );
  });
  const idealMinutes = idealDailyMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const rangeStart = localDayRange(startDate, timezone).startAt;
  const rangeEnd = localDayRange(endDate, timezone).endAt;
  const actualMinutes = eligible.reduce((total, thread) => total + thread.history
    .filter((entry) => entry.source === "fact")
    .reduce((sum, entry) => {
      const overlap = intersection(
        { startAt: new Date(entry.startAt), endAt: new Date(entry.endAt) },
        { startAt: rangeStart, endAt: rangeEnd }
      );
      return sum + (overlap ? minutesInRange(overlap) : 0);
    }, 0), 0);
  const loadDays = idealDailyMinutes.filter((minutes) => minutes > EPSILON).length;

  return {
    actualMinutes,
    averageActualMinutes: loadDays > 0 ? actualMinutes / loadDays : 0,
    idealMinutes,
    rate: idealMinutes > EPSILON ? actualMinutes / idealMinutes : null
  };
}

function cleanDisplayMinutes(value: number): number {
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < 1e-5 ? nearest : value;
}

function buildIdealMatrix(
  threads: Thread[],
  today: string,
  lastDay: string
): { allocations: Map<string, number[]> } {
  const firstDay = [today, ...threads.map((thread) => thread.start ?? today)].sort()[0] ?? today;
  const fullDates = dayKeys(firstDay, lastDay);
  const todayIndex = fullDates.indexOf(today);
  const totals = Array(fullDates.length).fill(0) as number[];
  const fullAllocations = new Map<string, number[]>();
  const specs = threads.map((thread) => ({
    key: thread.key,
    minutes: thread.expectedMinutes ?? 0,
    startIndex: fullDates.indexOf(thread.start ?? today),
    endIndex: fullDates.indexOf(thread.deadline!),
    steady: thread.steadyDaily ?? false
  }));

  for (const spec of specs.filter((item) => item.steady)) {
    const allocation = Array(fullDates.length).fill(0) as number[];
    const daily = spec.minutes / (spec.endIndex - spec.startIndex + 1);
    for (let day = spec.startIndex; day <= spec.endIndex; day += 1) {
      allocation[day] = daily;
      totals[day] += daily;
    }
    fullAllocations.set(spec.key, allocation);
  }

  const flexible = specs.filter((item) => !item.steady);
  const boundaries = [...new Set([
    0,
    ...specs.flatMap((item) => [item.startIndex, item.endIndex + 1]),
    fullDates.length
  ])].filter((value) => value >= 0 && value <= fullDates.length).sort((a, b) => a - b);
  const cohorts = new Map<string, typeof flexible>();
  for (const spec of flexible) {
    const key = `${spec.startIndex}:${spec.endIndex}`;
    const cohort = cohorts.get(key) ?? [];
    cohort.push(spec);
    cohorts.set(key, cohort);
  }
  const cohortSpecs = [...cohorts.entries()].map(([key, cohort]) => ({
    key,
    minutes: cohort.reduce((sum, item) => sum + item.minutes, 0),
    startIndex: cohort[0]!.startIndex,
    endIndex: cohort[0]!.endIndex
  }));
  const solution = solveDailyLoadByIntervals(cohortSpecs, totals, boundaries);
  for (const cohort of cohorts.values()) {
    const totalMinutes = cohort.reduce((sum, item) => sum + item.minutes, 0);
    const aggregate = Array(fullDates.length).fill(0) as number[];
    const cohortKey = `${cohort[0]!.startIndex}:${cohort[0]!.endIndex}`;
    const intervalValues = solution.intervalAllocations.get(cohortKey) ?? [];
    intervalValues.forEach((value, interval) => {
      for (let day = boundaries[interval]!; day < boundaries[interval + 1]!; day += 1) aggregate[day] = value[0]!;
    });
    for (const spec of cohort.sort((a, b) => a.key.localeCompare(b.key))) {
      const share = totalMinutes > EPSILON ? spec.minutes / totalMinutes : 0;
      fullAllocations.set(spec.key, aggregate.map((minutes, day) => {
        const interval = boundaries.findIndex((start, index) => day >= start && day < boundaries[index + 1]!);
        const intervalStart = boundaries[interval] ?? day;
        const intervalEnd = boundaries[interval + 1] ?? day + 1;
        const intervalTotal = aggregate.slice(intervalStart, intervalEnd).reduce((sum, value) => sum + value, 0);
        return (intervalTotal / Math.max(1, intervalEnd - intervalStart)) * share;
      }));
    }
  }

  return {
    allocations: new Map(threads.map((thread) => [
      thread.key,
      (fullAllocations.get(thread.key) ?? Array(fullDates.length).fill(0) as number[]).slice(todayIndex)
    ]))
  };
}

function settlePastDeviations(
  items: LoadItem[],
  allocations: Map<string, number[]>,
  strategy: DailyLoadSettlementStrategy
): void {
  const idealAllocations = new Map(
    items.map((item) => [item.key, [...allocations.get(item.key)!]])
  );
  const adjustments = items.map((item) => {
    const idealFuture = allocations.get(item.key)!.reduce((sum, minutes) => sum + minutes, 0);
    return { item, remaining: item.openingMinutes - idealFuture };
  });
  const donors = adjustments.filter((entry) => entry.remaining < -EPSILON)
    .map((entry) => ({ item: entry.item, remaining: -entry.remaining }));
  const deficits = adjustments.filter((entry) => entry.remaining > EPSILON)
    .sort((a, b) => a.item.key.localeCompare(b.item.key));

  const lastDay = Math.max(-1, ...items.map((item) => item.endIndex));
  for (let day = 0; day <= lastDay; day += 1) {
    const eligible = deficits.filter((entry) =>
      entry.remaining > EPSILON && day >= entry.item.startIndex && day <= entry.item.endIndex &&
      idealAllocations.get(entry.item.key)![day]! > EPSILON
    );
    const deficit = eligible.reduce((sum, entry) => sum + entry.remaining, 0);
    if (deficit <= EPSILON) continue;
    const exchanged = releaseFromDonors(donors, allocations, day, deficit);
    distributeToDeficits(eligible, allocations, day, exchanged);
  }

  for (const entry of deficits.filter((candidate) => candidate.remaining > EPSILON)) {
    const allocation = allocations.get(entry.item.key)!;
    const idealAllocation = idealAllocations.get(entry.item.key)!;
    const itemStart = Math.max(0, entry.item.startIndex);
    if (strategy === "curve-preservation") {
      scaleByBasis(allocation, idealAllocation, entry.remaining, itemStart, entry.item.endIndex);
    } else {
      const dailyIncrease = entry.remaining / (entry.item.endIndex - itemStart + 1);
      for (let day = itemStart; day <= entry.item.endIndex; day += 1) allocation[day] += dailyIncrease;
    }
    entry.remaining = 0;
  }

  for (const donor of donors.filter((entry) => entry.remaining > EPSILON)) {
    removeProportionally(
      allocations.get(donor.item.key)!,
      donor.remaining,
      Math.max(0, donor.item.startIndex),
      donor.item.endIndex
    );
  }
}

function scaleByBasis(
  allocation: number[],
  basis: number[],
  minutes: number,
  start: number,
  end: number
): void {
  const totalBasis = basis
    .slice(start, end + 1)
    .reduce((sum, value) => sum + Math.max(0, value), 0);
  if (totalBasis <= EPSILON) {
    const daily = minutes / Math.max(1, end - start + 1);
    for (let day = start; day <= end; day += 1) allocation[day] += daily;
    return;
  }
  for (let day = start; day <= end; day += 1) {
    const weight = Math.max(0, basis[day]!) / totalBasis;
    allocation[day] += minutes * weight;
  }
}

function releaseFromDonors(
  donors: Array<{ item: LoadItem; remaining: number }>,
  allocations: Map<string, number[]>,
  day: number,
  requested: number
): number {
  let remaining = requested;
  let released = 0;
  while (remaining > EPSILON) {
    const available = donors.filter((donor) =>
      donor.remaining > EPSILON && day >= donor.item.startIndex && day <= donor.item.endIndex &&
      allocations.get(donor.item.key)![day]! > EPSILON
    );
    if (available.length === 0) break;
    const totalWeight = available.reduce((sum, donor) => sum + donor.remaining, 0);
    let round = 0;
    for (const donor of available) {
      const allocation = allocations.get(donor.item.key)!;
      const share = remaining * donor.remaining / totalWeight;
      const minutes = Math.min(share, donor.remaining, allocation[day]!);
      allocation[day] -= minutes;
      donor.remaining -= minutes;
      round += minutes;
    }
    if (round <= EPSILON) break;
    released += round;
    remaining -= round;
  }
  return released;
}

function distributeToDeficits(
  deficits: Array<{ item: LoadItem; remaining: number }>,
  allocations: Map<string, number[]>,
  day: number,
  minutes: number
): void {
  let undistributed = minutes;
  while (undistributed > EPSILON) {
    const eligible = deficits.filter((entry) => entry.remaining > EPSILON);
    const totalWeight = eligible.reduce((sum, entry) => sum + entry.remaining, 0);
    if (totalWeight <= EPSILON) return;

    let distributed = 0;
    for (const entry of eligible) {
      const received = Math.min(
        entry.remaining,
        undistributed * entry.remaining / totalWeight
      );
      allocations.get(entry.item.key)![day] += received;
      entry.remaining -= received;
      distributed += received;
    }
    if (distributed <= EPSILON) return;
    undistributed -= distributed;
  }
}

function applyTodayFacts(items: LoadItem[], allocations: Map<string, number[]>): void {
  for (const item of items) {
    if (item.todayFactMinutes <= EPSILON || item.startIndex > 0) continue;
    const allocation = allocations.get(item.key)!;
    const openingToday = allocation[0]!;
    allocation[0] = openingToday - item.todayFactMinutes;
  }
}

function removeProportionally(allocation: number[], minutes: number, start: number, end: number): void {
  const available = allocation
    .slice(start, end + 1)
    .reduce((sum, dailyMinutes) => sum + Math.max(0, dailyMinutes), 0);
  if (available <= EPSILON) return;

  const retainedShare = Math.max(0, 1 - Math.min(minutes, available) / available);
  for (let day = start; day <= end; day += 1) {
    if (allocation[day]! > EPSILON) allocation[day] *= retainedShare;
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
  return thread.factGapMinutes !== null && thread.factGapMinutes >= 0 && thread.expectedMinutes !== null;
}

function toLoadItem(thread: Thread, today: string, dates: string[], timezone: string): LoadItem {
  const start = [today, thread.start ?? today].sort().at(-1)!;
  const minutes = thread.factGapMinutes ?? 0;
  const todayRange = localDayRange(today, timezone);
  const todayFactMinutes = thread.history
    .filter((entry) => entry.source === "fact")
    .reduce((sum, entry) => {
      const overlap = intersection(
        { startAt: new Date(entry.startAt), endAt: new Date(entry.endAt) },
        todayRange
      );
      return sum + (overlap ? minutesInRange(overlap) : 0);
    }, 0);
  return {
    key: thread.key,
    label: `${thread.group}：${thread.item}`,
    openingMinutes: minutes + todayFactMinutes,
    startIndex: dates.indexOf(start),
    endIndex: dates.indexOf(thread.deadline!),
    steady: thread.steadyDaily ?? false,
    todayFactMinutes
  };
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
  const totalA = a.dailyMinutes === 0 ? 0 : Math.ceil(a.dailyMinutes);
  const totalB = b.dailyMinutes === 0 ? 0 : Math.ceil(b.dailyMinutes);
  if (totalA !== totalB || a.contributions.length !== b.contributions.length) return false;
  const displayA = apportionDisplayMinutes(a.contributions, totalA);
  const displayB = apportionDisplayMinutes(b.contributions, totalB);
  return displayA.every((item, index) =>
    item.key === displayB[index]?.key && item.displayMinutes === displayB[index]?.displayMinutes
  );
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
