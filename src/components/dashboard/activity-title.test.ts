import { describe, expect, it } from "vitest";
import { compactActivityTitle } from "./activity-title";

describe("compactActivityTitle", () => {
  it("returns the trailing sequence number", () => {
    expect(compactActivityTitle("Afloat：MVP 12")).toBe("12");
  });

  it("returns null for an unnumbered activity", () => {
    expect(compactActivityTitle("内部偏移：刷手机")).toBeNull();
  });

  it("does not treat digits inside a title as a sequence", () => {
    expect(compactActivityTitle("阅读第 2 章笔记")).toBeNull();
  });
});
