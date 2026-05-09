import { describe, expect, it } from "vitest";

import { sampleInput } from "@/server/views/sample-data";
import { buildDerivedViews } from "@/server/views/derived-view";
import { buildDashboardRangeView } from "@/server/services/dashboard-range";

import { summarizeViews } from "./view-summary";

describe("summarizeViews", () => {
  it("returns stable recompute summary shape from derived views", () => {
    const views = buildDerivedViews(sampleInput());
    const rangeView = buildDashboardRangeView({
      view: views.private,
      request: { range: "custom", start: "2026-05-07", end: "2026-05-08" },
      timezone: "UTC",
      now: new Date(views.private.generatedAt)
    });
    const summary = summarizeViews(views, rangeView);

    expect(summary).toEqual({
      generatedAt: views.private.generatedAt,
      private: {
        plannedMinutes: views.private.plannedMinutes,
        fulfillmentRate: views.private.fulfillmentRate,
        protocolErrors: views.private.protocolErrors.length,
        threads: views.private.threads.length
      },
      range: {
        label: "2026-05-07 至 2026-05-08",
        startDate: "2026-05-07",
        endDate: "2026-05-08",
        startAt: "2026-05-07T00:00:00.000Z",
        endAt: "2026-05-09T00:00:00.000Z",
        plannedMinutes: 510,
        plannedDays: 1,
        averagePlannedMinutes: 510,
        fulfilledPlanMinutes: 510,
        fulfillmentRate: 1,
        maintenanceRate: 0.5,
        protocolErrors: 0
      }
    });
  });
});
