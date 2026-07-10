import { describe, expect, it } from "vitest";

import { projectRangeViewForNow } from "./range-now-projection";

describe("projectRangeViewForNow", () => {
  it("adds elapsed plan minutes after the server snapshot to range facts", () => {
    const rangeView = projectRangeViewForNow({
      view: {
        generatedAt: "2026-07-05T10:00:00.000Z",
        observedSemantics: ["ideal"],
        plannedMinutes: 120,
        fulfilledPlanMinutes: 0,
        internalFulfilledPlanMinutes: 0,
        internalFulfillmentRate: 0,
        fulfillmentRate: 0,
        maintenanceRate: 1,
        factTotals: {},
        protocolErrors: [],
        planTimeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T12:00:00.000Z",
            kind: "ideal",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        timeline: [],
        threadGroups: [],
        threads: [],
        notes: []
      },
      rangeView: {
        key: "day",
        quickRange: "day",
        label: "今天",
        timezone: "UTC",
        startDate: "2026-07-05",
        endDate: "2026-07-05",
        startAt: "2026-07-05T00:00:00.000Z",
        endAt: "2026-07-06T00:00:00.000Z",
        plannedMinutes: 120,
        plannedDays: 1,
        observedPlannedMinutes: 0,
        observedPlannedDays: 0,
        averagePlannedMinutes: 120,
        fulfilledPlanMinutes: 0,
        internalFulfilledPlanMinutes: 0,
        internalFulfillmentRate: 0,
        fulfillmentRate: 0,
        maintenanceRate: 1,
        factTotals: {},
        planTotals: { ideal: 120 },
        shiftComposition: {},
        protocolErrors: [],
        timeline: [],
        notes: []
      },
      runtimeNowIso: "2026-07-05T10:30:00.000Z"
    });

    expect(rangeView.fulfilledPlanMinutes).toBe(30);
    expect(rangeView.internalFulfilledPlanMinutes).toBe(30);
    expect(rangeView.observedPlannedMinutes).toBe(30);
    expect(rangeView.observedPlannedDays).toBe(1);
    expect(rangeView.internalFulfillmentRate).toBe(1);
    expect(rangeView.fulfillmentRate).toBe(1);
    expect(rangeView.factTotals).toEqual({ idealFulfilled: 30 });
    expect(rangeView.timeline).toEqual([
      {
        startAt: "2026-07-05T10:00:00.000Z",
        endAt: "2026-07-05T10:30:00.000Z",
        kind: "idealFulfilled",
        minutes: 30,
        title: "Afloat: Sync 1",
        group: "Afloat",
        item: "Sync"
      }
    ]);
  });

  it("merges projected facts with adjacent server facts for the same plan", () => {
    const rangeView = projectRangeViewForNow({
      view: {
        generatedAt: "2026-07-05T10:30:00.000Z",
        observedSemantics: ["ideal"],
        plannedMinutes: 120,
        fulfilledPlanMinutes: 30,
        internalFulfilledPlanMinutes: 30,
        internalFulfillmentRate: 0.25,
        fulfillmentRate: 0.25,
        maintenanceRate: 1,
        factTotals: {},
        protocolErrors: [],
        planTimeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T12:00:00.000Z",
            kind: "ideal",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        timeline: [],
        threadGroups: [],
        threads: [],
        notes: []
      },
      rangeView: {
        key: "day",
        quickRange: "day",
        label: "今天",
        timezone: "UTC",
        startDate: "2026-07-05",
        endDate: "2026-07-05",
        startAt: "2026-07-05T00:00:00.000Z",
        endAt: "2026-07-06T00:00:00.000Z",
        plannedMinutes: 120,
        plannedDays: 1,
        observedPlannedMinutes: 30,
        observedPlannedDays: 1,
        averagePlannedMinutes: 120,
        fulfilledPlanMinutes: 30,
        internalFulfilledPlanMinutes: 30,
        internalFulfillmentRate: 0.25,
        fulfillmentRate: 0.25,
        maintenanceRate: 1,
        factTotals: { idealFulfilled: 30 },
        planTotals: { ideal: 120 },
        shiftComposition: {},
        protocolErrors: [],
        timeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T10:30:00.000Z",
            kind: "idealFulfilled",
            minutes: 30,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        notes: []
      },
      runtimeNowIso: "2026-07-05T11:00:00.000Z"
    });

    expect(rangeView.fulfilledPlanMinutes).toBe(60);
    expect(rangeView.internalFulfilledPlanMinutes).toBe(60);
    expect(rangeView.factTotals).toEqual({ idealFulfilled: 60 });
    expect(rangeView.timeline).toEqual([
      {
        startAt: "2026-07-05T10:00:00.000Z",
        endAt: "2026-07-05T11:00:00.000Z",
        kind: "idealFulfilled",
        minutes: 60,
        title: "Afloat: Sync 1",
        group: "Afloat",
        item: "Sync"
      }
    ]);
  });

  it("projects from the server snapshot when the display timeline contains the full plan range", () => {
    const rangeView = projectRangeViewForNow({
      view: {
        generatedAt: "2026-07-05T10:30:00.000Z",
        observedSemantics: ["ideal"],
        plannedMinutes: 120,
        fulfilledPlanMinutes: 30,
        internalFulfilledPlanMinutes: 30,
        internalFulfillmentRate: 1,
        fulfillmentRate: 1,
        maintenanceRate: 1,
        factTotals: {},
        protocolErrors: [],
        planTimeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T12:00:00.000Z",
            kind: "ideal",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        timeline: [],
        threadGroups: [],
        threads: [],
        notes: []
      },
      rangeView: {
        key: "day",
        quickRange: "day",
        label: "今天",
        timezone: "UTC",
        startDate: "2026-07-05",
        endDate: "2026-07-05",
        startAt: "2026-07-05T00:00:00.000Z",
        endAt: "2026-07-06T00:00:00.000Z",
        plannedMinutes: 120,
        plannedDays: 1,
        observedPlannedMinutes: 30,
        observedPlannedDays: 1,
        averagePlannedMinutes: 120,
        fulfilledPlanMinutes: 30,
        internalFulfilledPlanMinutes: 30,
        internalFulfillmentRate: 1,
        fulfillmentRate: 1,
        maintenanceRate: 1,
        factTotals: { idealFulfilled: 30 },
        planTotals: { ideal: 120 },
        shiftComposition: {},
        protocolErrors: [],
        timeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T12:00:00.000Z",
            kind: "idealFulfilled",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        notes: []
      },
      runtimeNowIso: "2026-07-05T11:00:00.000Z"
    });

    expect(rangeView.fulfilledPlanMinutes).toBe(60);
    expect(rangeView.factTotals).toEqual({ idealFulfilled: 60 });
  });

  it("does not double count ranges already present in the server timeline", () => {
    const rangeView = projectRangeViewForNow({
      view: {
        generatedAt: "2026-07-05T10:00:00.000Z",
        observedSemantics: ["ideal"],
        plannedMinutes: 120,
        fulfilledPlanMinutes: 120,
        internalFulfilledPlanMinutes: 120,
        internalFulfillmentRate: 1,
        fulfillmentRate: 1,
        maintenanceRate: 1,
        factTotals: {},
        protocolErrors: [],
        planTimeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T12:00:00.000Z",
            kind: "ideal",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        timeline: [],
        threadGroups: [],
        threads: [],
        notes: []
      },
      rangeView: {
        key: "day",
        quickRange: "day",
        label: "今天",
        timezone: "UTC",
        startDate: "2026-07-05",
        endDate: "2026-07-05",
        startAt: "2026-07-05T00:00:00.000Z",
        endAt: "2026-07-06T00:00:00.000Z",
        plannedMinutes: 120,
        plannedDays: 1,
        observedPlannedMinutes: 120,
        observedPlannedDays: 1,
        averagePlannedMinutes: 120,
        fulfilledPlanMinutes: 120,
        internalFulfilledPlanMinutes: 120,
        internalFulfillmentRate: 1,
        fulfillmentRate: 1,
        maintenanceRate: 1,
        factTotals: { idealFulfilled: 120 },
        planTotals: { ideal: 120 },
        shiftComposition: {},
        protocolErrors: [],
        timeline: [
          {
            startAt: "2026-07-05T10:00:00.000Z",
            endAt: "2026-07-05T12:00:00.000Z",
            kind: "idealFulfilled",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        notes: []
      },
      runtimeNowIso: "2026-07-05T10:30:00.000Z"
    });

    expect(rangeView.fulfilledPlanMinutes).toBe(120);
    expect(rangeView.factTotals).toEqual({ idealFulfilled: 120 });
    expect(rangeView.timeline).toHaveLength(1);
  });

  it("does not project time already included by a server range built from a stale view", () => {
    const input = {
      view: {
        generatedAt: "2026-07-05T09:00:00.000Z",
        observedSemantics: ["ideal"],
        plannedMinutes: 120,
        fulfilledPlanMinutes: 120,
        internalFulfilledPlanMinutes: 120,
        internalFulfillmentRate: 1,
        fulfillmentRate: 1,
        maintenanceRate: 1,
        factTotals: {},
        protocolErrors: [],
        planTimeline: [
          {
            startAt: "2026-07-05T09:00:00.000Z",
            endAt: "2026-07-05T11:00:00.000Z",
            kind: "ideal",
            minutes: 120,
            title: "Afloat: Sync 1",
            group: "Afloat",
            item: "Sync"
          }
        ],
        timeline: [],
        threadGroups: [],
        threads: [],
        notes: []
      },
      rangeView: {
        key: "day" as const,
        quickRange: "day" as const,
        label: "今天",
        timezone: "UTC",
        startDate: "2026-07-05",
        endDate: "2026-07-05",
        startAt: "2026-07-05T00:00:00.000Z",
        endAt: "2026-07-06T00:00:00.000Z",
        plannedMinutes: 120,
        plannedDays: 1,
        observedPlannedMinutes: 90,
        observedPlannedDays: 1,
        averagePlannedMinutes: 120,
        fulfilledPlanMinutes: 90,
        internalFulfilledPlanMinutes: 90,
        internalFulfillmentRate: 1,
        fulfillmentRate: 1,
        maintenanceRate: 1,
        runtimeNow: "2026-07-05T10:30:00.000Z",
        factTotals: { idealFulfilled: 90 },
        planTotals: { ideal: 120 },
        shiftComposition: {},
        protocolErrors: [],
        timeline: [],
        notes: []
      },
      runtimeNowIso: "2026-07-05T10:30:00.000Z"
    };

    const rangeView = projectRangeViewForNow(input);

    expect(rangeView.fulfilledPlanMinutes).toBe(90);
    expect(rangeView.internalFulfillmentRate).toBe(1);
  });
});
