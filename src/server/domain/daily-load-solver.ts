export interface DailyLoadSolverItem {
  key: string;
  minutes: number;
  startIndex: number;
  endIndex: number;
}

export interface DailyLoadSolution {
  peak: number;
  allocations: Map<string, number[]>;
}

export interface DailyLoadIntervalSolution extends DailyLoadSolution {
  intervalAllocations: Map<string, number[][]>;
}

const EPSILON = 1e-7;

export function solveDailyLoadByIntervals(
  items: DailyLoadSolverItem[],
  fixedLoad: number[],
  boundaries: number[],
): DailyLoadIntervalSolution {
  const intervalCount = Math.max(0, boundaries.length - 1);
  const lengths = boundaries.slice(0, -1).map((start, index) => boundaries[index + 1]! - start);
  const intervalLoad = boundaries.slice(0, -1).map((start) => fixedLoad[start] ?? 0);
  let low = Math.max(...intervalLoad, 0);
  let high = low + items.reduce((sum, item) => sum + Math.max(0, item.minutes), 0);
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const mid = (low + high) / 2;
    if (intervalFeasible(items, boundaries, lengths, intervalLoad, mid)) high = mid;
    else low = mid;
  }
  const intervalAllocations = extractIntervals(items, boundaries, lengths, intervalLoad, high);
  const allocations = new Map(items.map((item) => [item.key, Array(fixedLoad.length).fill(0) as number[]]));
  for (const item of items) {
    const values = intervalAllocations.get(item.key) ?? [];
    values.forEach((value, index) => {
      for (let day = boundaries[index]!; day < boundaries[index + 1]!; day += 1) allocations.get(item.key)![day] = value[0]!;
    });
  }
  return { peak: high, allocations, intervalAllocations };
}

function intervalFeasible(items: DailyLoadSolverItem[], boundaries: number[], lengths: number[], fixed: number[], peak: number): boolean {
  const remaining = items.map((item) => Math.max(0, item.minutes));
  for (let interval = 0; interval < lengths.length; interval += 1) {
    let capacity = Math.max(0, peak - fixed[interval]!) * lengths[interval]!;
    const start = boundaries[interval]!, end = boundaries[interval + 1]! - 1;
    const eligible = items.map((item, index) => ({ item, index }))
      .filter(({ item, index }) => remaining[index]! > EPSILON && start >= item.startIndex && end <= item.endIndex)
      .sort((a, b) => a.item.endIndex - b.item.endIndex || a.item.key.localeCompare(b.item.key));
    for (const { index } of eligible) {
      const used = Math.min(remaining[index]!, capacity);
      remaining[index] -= used; capacity -= used;
    }
  }
  return remaining.every((value) => value <= 1e-5);
}

function extractIntervals(items: DailyLoadSolverItem[], boundaries: number[], lengths: number[], fixed: number[], peak: number): Map<string, number[][]> {
  const result = new Map(items.map((item) => [item.key, boundaries.slice(0, -1).map(() => [0]) ]));
  const remaining = items.map((item) => Math.max(0, item.minutes));
  for (let interval = 0; interval < lengths.length; interval += 1) {
    let capacity = Math.max(0, peak - fixed[interval]!) * lengths[interval]!;
    const start = boundaries[interval]!, end = boundaries[interval + 1]! - 1;
    const eligible = items.map((item, index) => ({ item, index }))
      .filter(({ item, index }) => remaining[index]! > EPSILON && start >= item.startIndex && end <= item.endIndex)
      .sort((a, b) => a.item.endIndex - b.item.endIndex || a.item.key.localeCompare(b.item.key));
    for (const { item, index } of eligible) {
      const used = Math.min(remaining[index]!, capacity);
      result.get(item.key)![interval]![0] = used / lengths[interval]!;
      remaining[index] -= used; capacity -= used;
    }
  }
  return result;
}
