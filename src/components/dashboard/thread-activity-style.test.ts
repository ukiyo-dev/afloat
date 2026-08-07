import { describe, expect, it } from "vitest";
import { isAttributedThreadActivity, semanticThreadFillClass } from "./thread-activity-style";

describe("thread activity styling", () => {
  it("treats formal Items and the derived --- Item as Thread activities", () => {
    const attributions = [{ startAt: "2026-05-01T10:00:00Z", endAt: "2026-05-01T11:00:00Z", source: "fact", kind: "idealFulfilled", title: "Afloat:Daily", sourceEventId: "d", planEventId: "d", threadGroup: "Afloat", threadItem: "Daily Load" }] as any;
    expect(isAttributedThreadActivity({ startAt: attributions[0].startAt, endAt: attributions[0].endAt, sourceEventId: "d", planEventId: "d" }, attributions)).toBe(true);
  });

  it("does not attribute a different event with the same time range", () => {
    const attributions = [{ startAt: "2026-05-01T10:00:00Z", endAt: "2026-05-01T11:00:00Z", source: "fact", kind: "idealFulfilled", title: "Same", sourceEventId: "tracked", planEventId: "tracked", threadGroup: "Afloat", threadItem: "---" }] as any;
    expect(isAttributedThreadActivity({ startAt: attributions[0].startAt, endAt: attributions[0].endAt, sourceEventId: "other", planEventId: "other" }, attributions)).toBe(false);
  });

  it("uses a muted semantic fill only outside Threads", () => {
    expect(semanticThreadFillClass("idealFulfilled", true)).toBe("");
    expect(semanticThreadFillClass("idealFulfilled", false)).toBe("muted-semantic-work");
    expect(semanticThreadFillClass("internalShift", false)).toBe("");
  });
});
