import { describe, expect, it } from "vitest";
import { solveDailyLoadByIntervals } from "./daily-load-solver";

describe("solveDailyLoadByIntervals", () => {
  it("finds the global minimum peak for overlapping windows", () => {
    const result = solveDailyLoadByIntervals([
      { key: "a", minutes: 4, startIndex: 2, endIndex: 3 },
      { key: "b", minutes: 2, startIndex: 1, endIndex: 2 }
    ], [0, 0, 0, 0], [0, 1, 2, 3, 4]);

    expect(result.peak).toBeCloseTo(2);
    expect(result.intervalAllocations.get("a")![2]![0]).toBeCloseTo(2);
    expect(result.intervalAllocations.get("a")![3]![0]).toBeCloseTo(2);
    expect(result.intervalAllocations.get("b")![1]![0]).toBeCloseTo(2);
  });

  it("preserves fixed load and item totals", () => {
    const result = solveDailyLoadByIntervals([
      { key: "a", minutes: 6, startIndex: 0, endIndex: 2 },
      { key: "b", minutes: 2, startIndex: 1, endIndex: 2 }
    ], [1, 3, 0], [0, 1, 2, 3]);

    for (const item of ["a", "b"] as const) {
      expect(result.allocations.get(item)!.reduce((sum, value) => sum + value, 0))
        .toBeCloseTo(item === "a" ? 6 : 2);
    }
    expect(result.peak).toBeGreaterThanOrEqual(3);
    for (const [day, fixed] of [1, 3, 0].entries()) {
      const load = [...result.allocations.values()].reduce((sum, values) => sum + values[day]!, fixed);
      expect(load).toBeLessThanOrEqual(result.peak + 1e-5);
    }
  });

  it("matches exhaustive minimax results on small interval problems", () => {
    const cases = [
      {
        items: [
          { key: "a", minutes: 4, startIndex: 0, endIndex: 1 },
          { key: "b", minutes: 2, startIndex: 1, endIndex: 2 }
        ], fixed: [0, 0, 0], boundaries: [0, 1, 2, 3]
      },
      {
        items: [
          { key: "a", minutes: 3, startIndex: 0, endIndex: 2 },
          { key: "b", minutes: 2, startIndex: 0, endIndex: 1 },
          { key: "c", minutes: 1, startIndex: 1, endIndex: 2 }
        ], fixed: [1, 0, 1], boundaries: [0, 1, 2, 3]
      }
    ];
    for (const input of cases) {
      const result = solveDailyLoadByIntervals(input.items, input.fixed, input.boundaries);
      expect(result.peak).toBeCloseTo(exhaustivePeak(input.items, input.fixed, input.boundaries), 4);
    }
  });
});

function exhaustivePeak(
  items: Array<{ minutes: number; startIndex: number; endIndex: number }>,
  fixed: number[],
  boundaries: number[]
): number {
  let best = Number.POSITIVE_INFINITY;
  const allocations = items.map(() => Array(boundaries.length - 1).fill(0));
  const visit = (itemIndex: number) => {
    if (itemIndex === items.length) {
      const loads = fixed.map((value, interval) => value + allocations.reduce((sum, row) => sum + row[interval], 0));
      best = Math.min(best, Math.max(...loads));
      return;
    }
    const item = items[itemIndex]!;
    distribute(item.minutes, item.startIndex, item.endIndex, 0, (values) => {
      allocations[itemIndex] = values;
      visit(itemIndex + 1);
    }, boundaries.length - 1);
  };
  visit(0);
  return best;
}

function distribute(minutes: number, start: number, end: number, index: number, done: (values: number[]) => void, count: number, values = Array(count).fill(0)): void {
  if (index === end - start) {
    values[start + index] = minutes;
    done([...values]);
    return;
  }
  for (let value = 0; value <= minutes + 1e-9; value += 1 / 3) {
    values[start + index] = value;
    distribute(minutes - value, start, end, index + 1, done, count, values);
  }
}
