import { describe, expect, it } from "vitest";

import { parseCalendarEvents } from "./calendar";
import { buildFactLayer, commitmentStats } from "./facts";
import type { CalendarSource, RawCalendarEvent } from "./types";

const sources: CalendarSource[] = [
  { id: "ideal", name: "理想", semantic: "ideal" },
  { id: "leisure", name: "娱乐", semantic: "leisure" },
  { id: "internal", name: "内部偏移", semantic: "internalShift" }
];

describe("buildFactLayer", () => {
  it("splits plan fulfillment around shift overlays", () => {
    const events = parseCalendarEvents(sources, [
      raw("p1", "ideal", "Afloat：MVP 1", "2026-05-06T20:00:00Z", "2026-05-06T22:00:00Z"),
      raw("s1", "internal", "刷手机", "2026-05-06T20:30:00Z", "2026-05-06T21:00:00Z")
    ]);

    const result = buildFactLayer(events);

    expect(result.errors).toHaveLength(0);
    expect(result.facts.map((fact) => fact.kind)).toEqual([
      "idealFulfilled",
      "internalShift",
      "idealFulfilled"
    ]);
    expect(commitmentStats(result.cleanPlanSegments, result.facts)).toMatchObject({
      plannedMinutes: 120,
      fulfilledPlanMinutes: 90,
      fulfillmentRate: 0.75
    });
  });

  it("skips same-layer overlap ranges from statistics", () => {
    const events = parseCalendarEvents(sources, [
      raw("p1", "ideal", "写作", "2026-05-06T20:00:00Z", "2026-05-06T21:00:00Z"),
      raw("p2", "leisure", "看电影", "2026-05-06T20:30:00Z", "2026-05-06T21:30:00Z")
    ]);

    const result = buildFactLayer(events);

    expect(result.errors[0]?.type).toBe("planOverlap");
    expect(result.cleanPlanSegments).toHaveLength(2);
    expect(commitmentStats(result.cleanPlanSegments, result.facts)).toMatchObject({
      plannedMinutes: 60,
      fulfilledPlanMinutes: 60,
      fulfillmentRate: 1
    });
  });
});

function raw(
  id: string,
  calendarSourceId: string,
  title: string,
  startAt: string,
  endAt: string
): RawCalendarEvent {
  return {
    id,
    calendarSourceId,
    title,
    startAt: new Date(startAt),
    endAt: new Date(endAt)
  };
}
