import { describe, expect, it } from "vitest";

import { buildDerivedViews, type DerivedViewInput } from "./derived-view";

describe("buildDerivedViews", () => {
  it("builds the private mirror from the full local fact source", () => {
    const views = buildDerivedViews(sampleInput());

    expect(views.private.plannedMinutes).toBe(120);
    expect(views.private.fulfillmentRate).toBe(1);
    expect(views.private.factTotals).toEqual({ idealFulfilled: 120 });
    expect(views.private.planTimeline).toHaveLength(2);
    expect(views.private.timeline).toHaveLength(2);
    expect(views.private.notes.map((note) => note.id)).toEqual([
      "newer-private",
      "older-public"
    ]);
  });
});

function sampleInput(): DerivedViewInput {
  return {
    now: new Date("2026-05-08T12:00:00.000Z"),
    timezone: "UTC",
    calendarSources: [{ id: "ideal", name: "理想", semantic: "ideal" }],
    rawEvents: [
      {
        id: "newer",
        calendarSourceId: "ideal",
        title: "Afloat：镜像",
        startAt: new Date("2026-05-08T10:00:00.000Z"),
        endAt: new Date("2026-05-08T11:00:00.000Z")
      },
      {
        id: "older",
        calendarSourceId: "ideal",
        title: "旧主题：镜像",
        startAt: new Date("2026-03-01T10:00:00.000Z"),
        endAt: new Date("2026-03-01T11:00:00.000Z")
      }
    ],
    threadDeclarations: [],
    notes: [
      {
        id: "older-public",
        date: "2026-03-01",
        body: "old",
        visibility: "public"
      },
      {
        id: "newer-private",
        date: "2026-05-08",
        body: "hidden from visitors",
        visibility: "private"
      }
    ]
  };
}
