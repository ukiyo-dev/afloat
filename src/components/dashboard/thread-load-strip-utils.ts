import type { DashboardData } from "@/server/services/dashboard-service";
import { intersection, localDayRange, minutesInRange } from "@/server/domain/time";

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
  timezone = "UTC"
): ThreadLoadSegment[] {
  const eligible = threads.filter((thread) => isEligible(thread, today));
  if (eligible.length === 0) return [];

  const lastDay = eligible.map((thread) => thread.deadline!).sort().at(-1)!;
  const dates = dayKeys(today, lastDay);
  const items = eligible.map((thread) => toLoadItem(thread, today, dates, timezone));
  const ideal = buildIdealMatrix(eligible, today, lastDay);
  const originalAllocations = new Map(items.map((item) => [item.key, [...ideal.allocations.get(item.key)!]]));
  const allocations = new Map(items.map((item) => [item.key, [...ideal.allocations.get(item.key)!]]));
  settlePastDeviations(items, allocations);
  applyTodayFacts(items, allocations);
  const steadyBase = dates.map((_, day) => items
    .filter((item) => item.steady)
    .reduce((sum, item) => sum + Math.max(0, allocations.get(item.key)![day]!), 0));

  const days = dates.map((date, day) => {
    const contributions = items
      .map((item) => ({ key: item.key, label: item.label, dailyMinutes: allocations.get(item.key)![day]! }))
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

function buildIdealMatrix(
  threads: Thread[],
  today: string,
  lastDay: string
): { allocations: Map<string, number[]> } {
  const firstDay = threads.map((thread) => thread.start ?? today).sort()[0] ?? today;
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

  const cohorts = new Map<string, typeof specs>();
  for (const spec of specs.filter((item) => !item.steady)) {
    const cohortKey = `${spec.startIndex}:${spec.endIndex}`;
    const cohort = cohorts.get(cohortKey) ?? [];
    cohort.push(spec);
    cohorts.set(cohortKey, cohort);
  }
  const ordered = [...cohorts.values()].sort((a, b) =>
    (a[0]!.endIndex - a[0]!.startIndex) - (b[0]!.endIndex - b[0]!.startIndex) ||
    a[0]!.endIndex - b[0]!.endIndex || a[0]!.startIndex - b[0]!.startIndex
  );
  for (const cohort of ordered) {
    const first = cohort[0]!;
    const cohortMinutes = cohort.reduce((sum, item) => sum + item.minutes, 0);
    const cohortAllocation = waterFill(totals, first.startIndex, first.endIndex, cohortMinutes);
    for (const spec of cohort.sort((a, b) => a.key.localeCompare(b.key))) {
      const share = cohortMinutes > EPSILON ? spec.minutes / cohortMinutes : 0;
      fullAllocations.set(spec.key, cohortAllocation.map((minutes) => minutes * share));
    }
    addInto(totals, cohortAllocation, 1);
  }

  return {
    allocations: new Map(threads.map((thread) => [
      thread.key,
      (fullAllocations.get(thread.key) ?? Array(fullDates.length).fill(0) as number[]).slice(todayIndex)
    ]))
  };
}

function settlePastDeviations(items: LoadItem[], allocations: Map<string, number[]>): void {
  const adjustments = items.map((item) => {
    const idealFuture = allocations.get(item.key)!.reduce((sum, minutes) => sum + minutes, 0);
    return { item, remaining: item.openingMinutes - idealFuture };
  });
  const donors = adjustments.filter((entry) => entry.remaining < -EPSILON)
    .map((entry) => ({ item: entry.item, remaining: -entry.remaining }));
  const deficitGroups = new Map<number, typeof adjustments>();
  for (const entry of adjustments.filter((candidate) => candidate.remaining > EPSILON)) {
    const group = deficitGroups.get(entry.item.endIndex) ?? [];
    group.push(entry);
    deficitGroups.set(entry.item.endIndex, group);
  }

  for (const [deadline, group] of [...deficitGroups].sort((a, b) => a[0] - b[0])) {
    const orderedGroup = group.sort((a, b) => a.item.key.localeCompare(b.item.key));
    const start = Math.max(0, Math.min(...orderedGroup.map((entry) => entry.item.startIndex)));
    for (let day = start; day <= deadline; day += 1) {
      const eligible = orderedGroup.filter((entry) => entry.remaining > EPSILON && day >= entry.item.startIndex);
      const deficit = eligible.reduce((sum, entry) => sum + entry.remaining, 0);
      if (deficit <= EPSILON) break;
      const exchanged = releaseFromDonors(donors, allocations, day, deficit);
      distributeToDeficits(eligible, allocations, day, exchanged);
    }

    for (const entry of orderedGroup.filter((candidate) => candidate.remaining > EPSILON)) {
      const allocation = allocations.get(entry.item.key)!;
      const itemStart = Math.max(0, entry.item.startIndex);
      const dailyIncrease = entry.remaining / (deadline - itemStart + 1);
      for (let day = itemStart; day <= deadline; day += 1) allocation[day] += dailyIncrease;
      entry.remaining = 0;
    }
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
  const total = deficits.reduce((sum, entry) => sum + entry.remaining, 0);
  if (total <= EPSILON) return;
  for (const entry of deficits) {
    const received = Math.min(entry.remaining, minutes * entry.remaining / total);
    allocations.get(entry.item.key)![day] += received;
    entry.remaining -= received;
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
