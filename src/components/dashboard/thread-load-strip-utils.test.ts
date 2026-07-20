import { describe, expect, it } from "vitest";
import { buildThreadLoadSegments } from "./thread-load-strip-utils";

function thread(overrides: Record<string, unknown>) {
  return {
    key: "g/i", group: "G", item: "I", activityState: "active", source: "declared",
    fulfilledMinutes: 0, futureMinutes: 0, externalShiftMinutes: 0, internalShiftMinutes: 0,
    expectedMinutes: 600, start: "2026-07-20", deadline: "2026-07-29", factGapMinutes: 600,
    unscheduledGapMinutes: 600, planCoverageRate: 0, dailyRequiredMinutes: 60, remainingDays: 10,
    status: "needsScheduling", canDelete: false, closed: false, sequences: [], history: [],
    ...overrides
  } as any;
}

describe("buildThreadLoadSegments", () => {
  it("moves flexible load earlier to level the total across overlapping windows", () => {
    const result = buildThreadLoadSegments([
      thread({ key: "a", factGapMinutes: 600 }),
      thread({ key: "b", item: "Later", start: "2026-07-25", deadline: "2026-07-29", factGapMinutes: 300 })
    ], "2026-07-20");

    expect(result.map(({ start, end, dailyMinutes, originalDailyMinutes }) => ({ start, end, dailyMinutes, originalDailyMinutes }))).toEqual([
      { start: "2026-07-20", end: "2026-07-24", dailyMinutes: 90, originalDailyMinutes: 60 },
      { start: "2026-07-25", end: "2026-07-29", dailyMinutes: 90, originalDailyMinutes: 120 }
    ]);
  });

  it("uses fact gap and does not subtract future plans", () => {
    const result = buildThreadLoadSegments([
      thread({ factGapMinutes: 600, unscheduledGapMinutes: 100, futureMinutes: 500 })
    ], "2026-07-20");

    expect(result[0]?.dailyMinutes).toBe(60);
  });

  it("keeps declared fixed daily load constant across its active window", () => {
    const result = buildThreadLoadSegments([
      thread({ factGapMinutes: 120, declaredDailyMinutes: 45 })
    ], "2026-07-20");

    expect(result[0]?.dailyMinutes).toBe(45);
  });

  it("levels flexible work on top of fixed daily load", () => {
    const result = buildThreadLoadSegments([
      thread({ key: "fixed", factGapMinutes: 1, declaredDailyMinutes: 30 }),
      thread({ key: "flex", factGapMinutes: 300 })
    ], "2026-07-20");

    expect(result).toHaveLength(1);
    expect(result[0]?.fixedDailyMinutes).toBe(30);
    expect(result[0]?.dailyMinutes).toBe(60);
  });

  it("excludes expired, unbounded, fulfilled, and inactive items", () => {
    const result = buildThreadLoadSegments([
      thread({ deadline: null }),
      thread({ deadline: "2026-07-19" }),
      thread({ factGapMinutes: 0 }),
      thread({ activityState: "inactive" })
    ], "2026-07-20");

    expect(result).toEqual([]);
  });
});
