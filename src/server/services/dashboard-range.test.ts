import { describe, expect, it } from "vitest";

import {
  buildDashboardRangeView,
  dashboardDateRange,
  resolveDashboardRange
} from "./dashboard-range";
import type { PrivateDerivedView } from "@/server/views/derived-view";

describe("dashboard range", () => {
  it("resolves invalid ranges to the saved default", () => {
    expect(resolveDashboardRange("7d", "day")).toBe("7d");
    expect(resolveDashboardRange("bad", "30d")).toBe("30d");
    expect(resolveDashboardRange("bad", "also-bad")).toBe("yesterday");
  });

  it("builds day ranges at the configured timezone boundary", () => {
    const range = dashboardDateRange("day", "Asia/Shanghai", new Date("2026-05-07T12:00:00.000Z"));

    expect(range.startAt.toISOString()).toBe("2026-05-06T16:00:00.000Z");
    expect(range.endAt.toISOString()).toBe("2026-05-07T16:00:00.000Z");
  });

  it("clips plan and fact minutes to the selected range", () => {
    const view = samplePrivateView();
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "day" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.plannedMinutes).toBe(120);
    expect(rangeView.plannedDays).toBe(1);
    expect(rangeView.averagePlannedMinutes).toBe(120);
    expect(rangeView.fulfilledPlanMinutes).toBe(90);
    expect(rangeView.fulfillmentRate).toBe(0.75);
    expect(rangeView.maintenanceRate).toBe(1);
    expect(rangeView.factTotals).toEqual({
      idealFulfilled: 90,
      externalShift: 30
    });
    expect(rangeView.protocolErrors).toHaveLength(1);
    expect(rangeView.notes.map((note) => note.date)).toEqual(["2026-05-07"]);
  });

  it("uses an explicit local date for day windows", () => {
    const view = samplePrivateView();
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "day", date: "2026-05-06" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.key).toBe("day");
    expect(rangeView.label).toBe("昨天");
    expect(rangeView.startDate).toBe("2026-05-06");
    expect(rangeView.endDate).toBe("2026-05-06");
    expect(rangeView.protocolErrors.map((error) => error.date)).toEqual(["2026-05-06"]);
    expect(rangeView.notes.map((note) => note.date)).toEqual(["2026-05-06"]);
  });

  it("builds custom ranges as inclusive local date ranges", () => {
    const view = samplePrivateView();
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "custom", start: "2026-05-06", end: "2026-05-07" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.key).toBe("custom");
    expect(rangeView.quickRange).toBeNull();
    expect(rangeView.label).toBe("2026-05-06 至 2026-05-07");
    expect(rangeView.startDate).toBe("2026-05-06");
    expect(rangeView.endDate).toBe("2026-05-07");
    expect(rangeView.protocolErrors.map((error) => error.date)).toEqual([
      "2026-05-07",
      "2026-05-06"
    ]);
    expect(rangeView.notes.map((note) => note.date)).toEqual(["2026-05-07", "2026-05-06"]);
    expect(rangeView.maintenanceRate).toBe(1);
  });

  it("calculates maintenance rate from the selected start and end dates", () => {
    const view = samplePrivateView();
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "custom", start: "2026-05-05", end: "2026-05-07" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.maintenanceRate).toBe(2 / 3);
  });

  it("averages planned minutes by days that have plans", () => {
    const view = {
      ...samplePrivateView(),
      planTimeline: [
        ...samplePrivateView().planTimeline,
        {
          startAt: "2026-05-05T10:00:00.000Z",
          endAt: "2026-05-05T11:00:00.000Z",
          kind: "ideal",
          minutes: 60,
          title: "C / D",
          group: "C",
          item: "D"
        }
      ]
    };
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "custom", start: "2026-05-05", end: "2026-05-07" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.plannedMinutes).toBe(240);
    expect(rangeView.plannedDays).toBe(3);
    expect(rangeView.averagePlannedMinutes).toBe(80);
  });

  it("uses raw maintenance records rather than cleaned fact segments", () => {
    const view = {
      ...samplePrivateView(),
      planTimeline: [],
      timeline: [],
      maintenanceTimeline: [
        {
          startAt: "2026-05-06T08:00:00.000Z",
          endAt: "2026-05-06T09:00:00.000Z",
          kind: "ideal"
        }
      ]
    };
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "custom", start: "2026-05-05", end: "2026-05-07" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.maintenanceRate).toBe(1 / 3);
  });

  it("normalizes inverted custom range inputs", () => {
    const view = samplePrivateView();
    const rangeView = buildDashboardRangeView({
      view,
      request: { range: "custom", start: "2026-05-07", end: "2026-05-06" },
      timezone: "UTC",
      now: new Date("2026-05-07T12:00:00.000Z")
    });

    expect(rangeView.startDate).toBe("2026-05-06");
    expect(rangeView.endDate).toBe("2026-05-07");
  });
});

function samplePrivateView(): PrivateDerivedView {
  return {
    generatedAt: "2026-05-07T12:00:00.000Z",
    observedSemantics: ["ideal", "externalShift"],
    plannedMinutes: 180,
    fulfilledPlanMinutes: 90,
    fulfillmentRate: 0.5,
    maintenanceRate: 1,
    factTotals: {},
    protocolErrors: [
      {
        type: "planOverlap",
        date: "2026-05-07",
        startAt: "2026-05-07T08:00:00.000Z",
        endAt: "2026-05-07T08:30:00.000Z",
        message: "计划层重叠",
        eventIds: ["a", "b"]
      },
      {
        type: "shiftOverlap",
        date: "2026-05-06",
        startAt: "2026-05-06T08:00:00.000Z",
        endAt: "2026-05-06T08:30:00.000Z",
        message: "偏移层重叠",
        eventIds: ["c", "d"]
      }
    ],
    planTimeline: [
      {
        startAt: "2026-05-06T23:00:00.000Z",
        endAt: "2026-05-07T02:00:00.000Z",
        kind: "ideal",
        minutes: 180,
        title: "A / B",
        group: "A",
        item: "B"
      }
    ],
    timeline: [
      {
        startAt: "2026-05-07T00:30:00.000Z",
        endAt: "2026-05-07T02:00:00.000Z",
        kind: "idealFulfilled",
        minutes: 90,
        title: "A / B",
        group: "A",
        item: "B"
      },
      {
        startAt: "2026-05-06T23:30:00.000Z",
        endAt: "2026-05-07T00:30:00.000Z",
        kind: "externalShift",
        minutes: 60,
        title: "A / B",
        group: "A",
        item: "B"
      }
    ],
    threadGroups: [],
    threads: [],
    notes: [
      { id: "today", date: "2026-05-07", body: "today", visibility: "private" },
      { id: "yesterday", date: "2026-05-06", body: "yesterday", visibility: "private" }
    ]
  };
}
