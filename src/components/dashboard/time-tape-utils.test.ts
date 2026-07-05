import { describe, expect, it } from "vitest";

import { buildTimeTapeSlices, nowMarkerPositionPercent } from "./time-tape-utils";
import type { DashboardData } from "@/server/services/dashboard-service";

type Timeline = DashboardData["view"]["timeline"];

describe("buildTimeTapeSlices", () => {
  it("builds adjacent slices from shared boundaries", () => {
    const slices = buildTimeTapeSlices({
      timeline: [
        fact({
          startAt: "2026-05-07T18:00:00.000Z",
          endAt: "2026-05-07T19:30:00.000Z",
          kind: "idealFulfilled"
        }),
        fact({
          startAt: "2026-05-07T19:30:00.000Z",
          endAt: "2026-05-07T21:00:00.000Z",
          kind: "restFulfilled"
        })
      ],
      startDate: "2026-05-07T00:00:00.000Z",
      endDate: "2026-05-08T00:00:00.000Z"
    });

    expect(slices.map((slice) => [slice.startAt, slice.endAt, slice.fact?.kind ?? "gap"])).toEqual([
      ["2026-05-07T00:00:00.000Z", "2026-05-07T18:00:00.000Z", "gap"],
      ["2026-05-07T18:00:00.000Z", "2026-05-07T19:30:00.000Z", "idealFulfilled"],
      ["2026-05-07T19:30:00.000Z", "2026-05-07T21:00:00.000Z", "restFulfilled"],
      ["2026-05-07T21:00:00.000Z", "2026-05-08T00:00:00.000Z", "gap"]
    ]);
    expect(slices[1]?.endAt).toBe(slices[2]?.startAt);
  });

  it("clips facts to the tape window", () => {
    const slices = buildTimeTapeSlices({
      timeline: [
        fact({
          startAt: "2026-05-06T23:30:00.000Z",
          endAt: "2026-05-07T01:30:00.000Z",
          kind: "restFulfilled"
        })
      ],
      startDate: "2026-05-07T00:00:00.000Z",
      endDate: "2026-05-07T02:00:00.000Z"
    });

    expect(slices.map((slice) => [slice.startAt, slice.endAt, slice.fact?.kind ?? "gap"])).toEqual([
      ["2026-05-07T00:00:00.000Z", "2026-05-07T01:30:00.000Z", "restFulfilled"],
      ["2026-05-07T01:30:00.000Z", "2026-05-07T02:00:00.000Z", "gap"]
    ]);
  });
});

describe("nowMarkerPositionPercent", () => {
  it("returns the current-time position for today's single-day tape", () => {
    expect(
      nowMarkerPositionPercent({
        startDate: "2026-07-05T00:00:00.000Z",
        endDate: "2026-07-06T00:00:00.000Z",
        now: "2026-07-05T12:00:00.000Z",
        timezone: "UTC"
      })
    ).toBe(50);
  });

  it("does not render for a non-today single-day tape", () => {
    expect(
      nowMarkerPositionPercent({
        startDate: "2026-07-04T00:00:00.000Z",
        endDate: "2026-07-05T00:00:00.000Z",
        now: "2026-07-05T12:00:00.000Z",
        timezone: "UTC"
      })
    ).toBeNull();
  });

  it("does not render for a multi-day tape", () => {
    expect(
      nowMarkerPositionPercent({
        startDate: "2026-07-05T00:00:00.000Z",
        endDate: "2026-07-07T00:00:00.000Z",
        now: "2026-07-05T12:00:00.000Z",
        timezone: "UTC"
      })
    ).toBeNull();
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
    title: input.kind,
    group: "A",
    item: "B"
  };
}
