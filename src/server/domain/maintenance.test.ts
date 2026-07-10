import { describe, expect, it } from "vitest";

import { maintenanceRate } from "./maintenance";
import type { ParsedEvent } from "./types";

describe("maintenanceRate", () => {
  it("counts exactly the latest 30 local calendar days", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const events = Array.from({ length: 31 }, (_, offset) =>
      event(
        `event-${offset}`,
        new Date(Date.UTC(2026, 6, 10 - offset, 1)),
        new Date(Date.UTC(2026, 6, 10 - offset, 2))
      )
    );

    expect(maintenanceRate(events, now, 30, "UTC")).toBe(1);
  });

  it("uses local dates across a daylight-saving transition", () => {
    const now = new Date("2026-03-10T03:00:00.000Z");
    const events = Array.from({ length: 30 }, (_, offset) =>
      event(
        `event-${offset}`,
        new Date(Date.UTC(2026, 2, 9 - offset, 17)),
        new Date(Date.UTC(2026, 2, 9 - offset, 18))
      )
    );

    expect(maintenanceRate(events, now, 30, "America/New_York")).toBe(1);
  });

  it("counts every local date touched by an event spanning midnight", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const events = [
      event(
        "overnight",
        new Date("2026-07-08T23:30:00.000Z"),
        new Date("2026-07-09T00:30:00.000Z")
      )
    ];

    expect(maintenanceRate(events, now, 30, "UTC")).toBe(2 / 30);
  });
});

function event(id: string, startAt: Date, endAt: Date): ParsedEvent {
  return {
    id,
    calendarSourceId: "ideal",
    layer: "plan",
    kind: "ideal",
    startAt,
    endAt,
    title: {
      rawTitle: "维护记录",
      titleBody: "维护记录",
      group: "维护记录",
      item: "维护记录",
      sequence: null,
      quality: null
    }
  };
}
