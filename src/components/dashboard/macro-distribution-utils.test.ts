import { describe, expect, it } from "vitest";

import { buildMacroDistributionDays, filterMacroDistributionDay } from "./macro-distribution-utils";
import type { DashboardData } from "@/server/services/dashboard-service";

type Timeline = DashboardData["view"]["timeline"];

describe("buildMacroDistributionDays", () => {
  it("splits overnight facts across local days", () => {
    const days = buildMacroDistributionDays({
      timeline: [
        fact({
          startAt: "2026-05-06T15:30:00.000Z",
          endAt: "2026-05-06T23:30:00.000Z",
          kind: "restFulfilled"
        })
      ],
      timezone: "Asia/Shanghai",
      startDate: "2026-05-06",
      endDate: "2026-05-07"
    });

    expect(days.map((day) => [day.date, day.total])).toEqual([
      ["2026-05-06", 30],
      ["2026-05-07", 450]
    ]);
    expect(days[0]?.kinds.restFulfilled).toBe(30);
    expect(days[1]?.kinds.restFulfilled).toBe(450);
  });

  it("clips facts to the selected date window", () => {
    const days = buildMacroDistributionDays({
      timeline: [
        fact({
          startAt: "2026-05-06T23:00:00.000Z",
          endAt: "2026-05-07T02:00:00.000Z",
          kind: "idealFulfilled"
        })
      ],
      timezone: "UTC",
      startDate: "2026-05-07",
      endDate: "2026-05-07"
    });

    expect(days).toHaveLength(1);
    expect(days[0]?.total).toBe(120);
    expect(days[0]?.kinds.idealFulfilled).toBe(120);
  });

  it("shows facts before now and plans after now", () => {
    const days = buildMacroDistributionDays({
      timeline: [
        fact({
          startAt: "2026-05-07T10:00:00.000Z",
          endAt: "2026-05-07T14:00:00.000Z",
          kind: "idealFulfilled"
        })
      ],
      planTimeline: [
        fact({
          startAt: "2026-05-07T10:00:00.000Z",
          endAt: "2026-05-07T14:00:00.000Z",
          kind: "ideal"
        })
      ],
      now: "2026-05-07T12:00:00.000Z",
      timezone: "UTC",
      startDate: "2026-05-07",
      endDate: "2026-05-07"
    });

    expect(days[0]?.total).toBe(240);
    expect(days[0]?.kinds.idealFulfilled).toBe(120);
    expect(days[0]?.kinds.ideal).toBe(120);
  });
});

describe("filterMacroDistributionDay", () => {
  const day = {
    date: "2026-05-07",
    displayDate: "5月7日",
    total: 210,
    kinds: { ideal: 150, rest: 60 },
    threadKinds: { ideal: 90, rest: 20 }
  };

  it("combines the activity-kind and non-thread filters", () => {
    expect(filterMacroDistributionDay(day, ["ideal"], new Set(["non"]))).toMatchObject({
      total: 60,
      kinds: { ideal: 60 },
      threadKinds: {}
    });
  });

  it("shows only thread minutes while preserving their kinds", () => {
    expect(filterMacroDistributionDay(day, null, new Set(["thread"]))).toMatchObject({
      total: 110,
      kinds: { ideal: 90, rest: 20 },
      threadKinds: { ideal: 90, rest: 20 }
    });
  });

  it("returns an empty distribution when both scopes are disabled", () => {
    expect(filterMacroDistributionDay(day, null, new Set())).toMatchObject({
      total: 0,
      kinds: {},
      threadKinds: {}
    });
  });
});

function fact(input: {
  startAt: string;
  endAt: string;
  kind: string;
}): Timeline[number] {
  return {
    startAt: input.startAt,
    endAt: input.endAt,
    kind: input.kind,
    minutes: 0,
    title: "睡眠",
    group: "休息",
    item: "睡眠"
  };
}
