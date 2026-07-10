import { describe, expect, it } from "vitest";

import { buildMacroDistributionDays } from "./macro-distribution-utils";
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
