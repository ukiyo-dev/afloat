import { describe, expect, it } from "vitest";
import { isThreadActivity, semanticThreadFillClass, threadActivityKeys } from "./thread-activity-style";

describe("thread activity styling", () => {
  it("treats formal Items and the derived --- Item as Thread activities", () => {
    const keys = threadActivityKeys([
      { group: "Afloat", item: "Daily Load" },
      { group: "Afloat", item: "---" }
    ] as any);

    expect(isThreadActivity({ group: "Afloat", item: "Daily Load", kind: "idealFulfilled" }, keys)).toBe(true);
    expect(isThreadActivity({ group: "Afloat", item: "---", kind: "leisureFulfilled" }, keys)).toBe(true);
    expect(isThreadActivity({ group: "Other", item: "Task", kind: "idealFulfilled" }, keys)).toBe(false);
  });

  it("uses a muted semantic fill only outside Threads", () => {
    expect(semanticThreadFillClass("idealFulfilled", true)).toBe("");
    expect(semanticThreadFillClass("idealFulfilled", false)).toBe("muted-semantic-work");
    expect(semanticThreadFillClass("internalShift", false)).toBe("");
  });
});
