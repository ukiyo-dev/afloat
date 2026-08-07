import { describe, expect, it } from "vitest";

import { threadAttributionMinutes } from "./thread-attribution";
import type { ThreadActivityAttribution } from "../views/derived-view";

const attribution = {
  startAt: "2026-05-07T10:15:00.000Z",
  endAt: "2026-05-07T10:45:00.000Z",
  sourceEventId: "event-1",
  planEventId: "plan-1",
  source: "fact",
  kind: "idealFulfilled",
  title: "Writing:Research",
  threadGroup: "Writing",
  threadItem: "---"
} satisfies ThreadActivityAttribution;

describe("threadAttributionMinutes", () => {
  it("returns the exact attributed overlap", () => {
    expect(threadAttributionMinutes({
      startAt: "2026-05-07T10:00:00.000Z",
      endAt: "2026-05-07T11:00:00.000Z",
      sourceEventId: "event-1"
    }, [attribution])).toBe(30);
  });

  it("does not fall back to title when event identity is absent", () => {
    expect(threadAttributionMinutes({
      startAt: "2026-05-07T10:00:00.000Z",
      endAt: "2026-05-07T11:00:00.000Z"
    }, [attribution])).toBe(0);
  });

  it("does not double count overlapping attribution records", () => {
    expect(threadAttributionMinutes({
      startAt: "2026-05-07T10:00:00.000Z",
      endAt: "2026-05-07T11:00:00.000Z",
      sourceEventId: "event-1"
    }, [attribution, { ...attribution, startAt: "2026-05-07T10:30:00.000Z" }])).toBe(30);
  });
});
