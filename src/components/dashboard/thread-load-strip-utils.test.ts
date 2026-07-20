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

  it("keeps steady daily load even across its remaining window", () => {
    const result = buildThreadLoadSegments([
      thread({ factGapMinutes: 450, steadyDaily: true })
    ], "2026-07-20");

    expect(result[0]?.dailyMinutes).toBe(45);
  });

  it("levels flexible work on top of steady daily load", () => {
    const result = buildThreadLoadSegments([
      thread({ key: "steady", factGapMinutes: 300, steadyDaily: true }),
      thread({ key: "flex", factGapMinutes: 300 })
    ], "2026-07-20");

    expect(result).toHaveLength(1);
    expect(result[0]?.steadyDailyMinutes).toBe(30);
    expect(result[0]?.dailyMinutes).toBe(60);
  });

  it("keeps item allocation deterministic regardless of input order", () => {
    const items = [
      thread({ key: "wide", item: "Wide", factGapMinutes: 600 }),
      thread({ key: "late", item: "Late", start: "2026-07-25", factGapMinutes: 300 }),
      thread({ key: "early", item: "Early", deadline: "2026-07-24", factGapMinutes: 150 })
    ];

    expect(buildThreadLoadSegments(items, "2026-07-20")).toEqual(
      buildThreadLoadSegments([...items].reverse(), "2026-07-20")
    );
  });

  it("shares levelling proportionally between items with the same window", () => {
    const result = buildThreadLoadSegments([
      thread({ key: "steady", item: "Steady", factGapMinutes: 500, steadyDaily: true, start: "2026-07-25" }),
      thread({ key: "large", item: "Large", factGapMinutes: 600 }),
      thread({ key: "small", item: "Small", factGapMinutes: 300 })
    ], "2026-07-20");

    const early = result.find((segment) => segment.start === "2026-07-20")!;
    const late = result.find((segment) => segment.start === "2026-07-25")!;
    const earlyLarge = early.contributions.find((item) => item.key === "large")!.dailyMinutes;
    const earlySmall = early.contributions.find((item) => item.key === "small")!.dailyMinutes;
    const lateLarge = late.contributions.find((item) => item.key === "large")!.dailyMinutes;
    const lateSmall = late.contributions.find((item) => item.key === "small")!.dailyMinutes;

    expect(earlyLarge / earlySmall).toBeCloseTo(2);
    expect(lateLarge / lateSmall).toBeCloseTo(2);
    expect(earlyLarge).toBeGreaterThan(lateLarge);
    expect(earlySmall).toBeGreaterThan(lateSmall);
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
