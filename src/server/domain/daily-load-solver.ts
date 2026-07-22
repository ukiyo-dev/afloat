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

const EPSILON = 1e-7;

/** Global minimax allocation for divisible work on contiguous date windows. */
export function solveDailyLoad(
  items: DailyLoadSolverItem[],
  fixedLoad: number[],
): DailyLoadSolution {
  const days = fixedLoad.length;
  const total = items.reduce((sum, item) => sum + Math.max(0, item.minutes), 0);
  let low = Math.max(...fixedLoad, 0);
  let high = low + total;
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const mid = (low + high) / 2;
    if (feasible(items, fixedLoad, mid)) high = mid;
    else low = mid;
  }
  const allocations = extract(items, fixedLoad, high, days);
  return { peak: high, allocations };
}

function feasible(items: DailyLoadSolverItem[], fixedLoad: number[], peak: number): boolean {
  const remaining = items.map((item) => Math.max(0, item.minutes));
  for (let day = 0; day < fixedLoad.length; day += 1) {
    let capacity = Math.max(0, peak - fixedLoad[day]!);
    const eligible = items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => remaining[index]! > EPSILON && day >= item.startIndex && day <= item.endIndex)
      .sort((a, b) => a.item.endIndex - b.item.endIndex || a.item.key.localeCompare(b.item.key));
    for (const { index } of eligible) {
      const used = Math.min(remaining[index]!, capacity);
      remaining[index] -= used;
      capacity -= used;
    }
  }
  return remaining.every((value) => value <= 1e-5);
}

function extract(items: DailyLoadSolverItem[], fixedLoad: number[], peak: number, days: number): Map<string, number[]> {
  const allocations = new Map(items.map((item) => [item.key, Array(days).fill(0) as number[]]));
  const remaining = items.map((item) => Math.max(0, item.minutes));
  for (let day = 0; day < days; day += 1) {
    let capacity = Math.max(0, peak - fixedLoad[day]!);
    const eligible = items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => remaining[index]! > EPSILON && day >= item.startIndex && day <= item.endIndex)
      .sort((a, b) => a.item.endIndex - b.item.endIndex || a.item.key.localeCompare(b.item.key));
    for (const { item, index } of eligible) {
      const used = Math.min(remaining[index]!, capacity);
      allocations.get(item.key)![day] = used;
      remaining[index] -= used;
      capacity -= used;
    }
  }
  return allocations;
}
