import { describe, expect, it } from "vitest";
import { apportionDisplayMinutes, buildThreadLoadSegments } from "./thread-load-strip-utils";

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

    expect(result[0]).toMatchObject({ start: "2026-07-20", end: "2026-07-20", dailyMinutes: 60 });
    expect(result[1]).toMatchObject({ start: "2026-07-21", end: "2026-07-24" });
    expect(result[2]).toMatchObject({ start: "2026-07-25", end: "2026-07-29" });
    expect(result[1]?.dailyMinutes).toBeCloseTo(result[2]!.dailyMinutes);
  });

  it("uses fact gap and does not subtract future plans", () => {
    const result = buildThreadLoadSegments([
      thread({ factGapMinutes: 600, unscheduledGapMinutes: 100, futureMinutes: 500 })
    ], "2026-07-20");

    expect(result[0]?.dailyMinutes).toBe(60);
  });

  it("keeps steady daily load even across its remaining window", () => {
    const result = buildThreadLoadSegments([
      thread({ expectedMinutes: 450, factGapMinutes: 450, steadyDaily: true })
    ], "2026-07-20");

    expect(result[0]?.dailyMinutes).toBe(45);
    expect(result[1]?.dailyMinutes).toBe(45);
  });

  it("levels flexible work on top of steady daily load", () => {
    const result = buildThreadLoadSegments([
      thread({ key: "steady", factGapMinutes: 300, steadyDaily: true }),
      thread({ key: "flex", factGapMinutes: 300 })
    ], "2026-07-20");

    expect(result).toHaveLength(2);
    expect(result[0]?.steadyDailyMinutes).toBe(30);
    expect(result[0]?.dailyMinutes).toBe(60);
    expect(result[1]?.dailyMinutes).toBeCloseTo(60);
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
      thread({ key: "large", item: "Large", expectedMinutes: 600, factGapMinutes: 600 }),
      thread({ key: "small", item: "Small", expectedMinutes: 300, factGapMinutes: 300 })
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

  it("caps Today at the overall remaining-window average", () => {
    const result = buildThreadLoadSegments([
      thread({ expectedMinutes: 600, fulfilledMinutes: 0, factGapMinutes: 600 })
    ], "2026-07-21");

    expect(result[0]).toMatchObject({ start: "2026-07-21", end: "2026-07-21" });
    expect(result[0]?.dailyMinutes).toBeCloseTo(66.667);
    expect(result[1]?.dailyMinutes).toBeCloseTo(66.667);
  });

  it("carries yesterday's benefit into Today so a sufficiently advanced item can rest", () => {
    const result = buildThreadLoadSegments([
      thread({
        expectedMinutes: 600,
        fulfilledMinutes: 120,
        factGapMinutes: 480,
        history: [{
          startAt: "2026-07-20T09:00:00.000Z",
          endAt: "2026-07-20T11:00:00.000Z",
          kind: "ideal",
          minutes: 120,
          title: "G/I",
          source: "fact"
        }]
      })
    ], "2026-07-21");

    expect(result[0]).toMatchObject({ start: "2026-07-21", end: "2026-07-21", dailyMinutes: 0 });
    expect(result[1]?.dailyMinutes).toBe(60);
  });

  it("moves Today's allocation between items based on yesterday's item-level deviation", () => {
    const result = buildThreadLoadSegments([
      thread({
        key: "one",
        item: "One",
        expectedMinutes: 300,
        fulfilledMinutes: 60,
        factGapMinutes: 240,
        history: [{
          startAt: "2026-07-20T09:00:00.000Z",
          endAt: "2026-07-20T10:00:00.000Z",
          kind: "ideal",
          minutes: 60,
          title: "G/One",
          source: "fact"
        }]
      }),
      thread({ key: "two", item: "Two", expectedMinutes: 300, factGapMinutes: 300 })
    ], "2026-07-21");

    const today = result[0]!;
    expect(today.dailyMinutes).toBe(60);
    expect(today.contributions.find((item) => item.key === "one")).toBeUndefined();
    expect(today.contributions.find((item) => item.key === "two")?.dailyMinutes).toBe(60);
  });

  it("lets a large advance suppress Today across multiple following days", () => {
    const advanced = thread({
      expectedMinutes: 1800,
      fulfilledMinutes: 480,
      factGapMinutes: 1320,
      deadline: "2026-08-18"
    });

    const whileAhead = buildThreadLoadSegments([advanced], "2026-07-25");
    const afterCreditIsConsumed = buildThreadLoadSegments([advanced], "2026-07-28");

    expect(whileAhead[0]?.dailyMinutes).toBe(0);
    expect(afterCreditIsConsumed[0]?.dailyMinutes).toBeCloseTo(60);
  });

  it("keeps Today item shares equal to the future average when nothing has progressed", () => {
    const result = buildThreadLoadSegments([
      thread({ key: "a", expectedMinutes: 600, factGapMinutes: 600 }),
      thread({ key: "b", expectedMinutes: 300, factGapMinutes: 300 }),
      thread({ key: "c", expectedMinutes: 450, factGapMinutes: 450, steadyDaily: true })
    ], "2026-07-20");

    expect(result[0]?.contributions).toEqual(result[1]?.contributions);
    expect(apportionDisplayMinutes(result[0]!.contributions, Math.ceil(result[0]!.dailyMinutes))).toEqual(
      apportionDisplayMinutes(result[1]!.contributions, Math.ceil(result[1]!.dailyMinutes))
    );
  });

  it("puts the full remaining gap in Today for a one-day window", () => {
    const result = buildThreadLoadSegments([
      thread({
        expectedMinutes: 180,
        fulfilledMinutes: 30,
        factGapMinutes: 150,
        start: "2026-07-21",
        deadline: "2026-07-21"
      })
    ], "2026-07-21");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: "2026-07-21",
      end: "2026-07-21",
      days: 1,
      dailyMinutes: 150
    });
    expect(result[0]?.contributions[0]?.dailyMinutes).toBe(150);
  });

  it("shows today's facts beyond the opening allocation as a negative balance", () => {
    const result = buildThreadLoadSegments([
      thread({
        expectedMinutes: 600,
        fulfilledMinutes: 100,
        factGapMinutes: 500,
        history: [{
          startAt: "2026-07-21T09:00:00.000Z",
          endAt: "2026-07-21T10:40:00.000Z",
          kind: "ideal",
          minutes: 100,
          title: "G/I",
          source: "fact"
        }]
      })
    ], "2026-07-21", "UTC");

    expect(result[0]?.dailyMinutes).toBeCloseTo(-33.333);
    expect(result[1]?.dailyMinutes).toBeCloseTo(62.5);
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

describe("apportionDisplayMinutes", () => {
  it("keeps rounded contribution minutes equal to the displayed total", () => {
    const result = apportionDisplayMinutes([
      { key: "a", label: "A", dailyMinutes: 82.6 },
      { key: "b", label: "B", dailyMinutes: 82.6 },
      { key: "c", label: "C", dailyMinutes: 40.2 },
      { key: "d", label: "D", dailyMinutes: 30.1 }
    ], 236);

    expect(result.map((item) => item.displayMinutes)).toEqual([83, 83, 40, 30]);
    expect(result.reduce((sum, item) => sum + item.displayMinutes, 0)).toBe(236);
  });

  it("preserves a negative Today balance while rounding", () => {
    const result = apportionDisplayMinutes([
      { key: "ahead", label: "Ahead", dailyMinutes: -30.2 },
      { key: "due", label: "Due", dailyMinutes: 60.4 }
    ], 31);

    expect(result.reduce((sum, item) => sum + item.displayMinutes, 0)).toBe(31);
    expect(result.find((item) => item.key === "ahead")?.displayMinutes).toBe(-30);
    expect(result.find((item) => item.key === "due")?.displayMinutes).toBe(61);
  });
});
