import { describe, expect, it } from "vitest";

import { parseDurationText } from "./duration";

describe("parseDurationText", () => {
  it("supports the strict integer syntax used by server inputs", () => {
    expect(parseDurationText("120", { compactWhitespace: true })).toBe(120);
    expect(parseDurationText("2h 30m", { compactWhitespace: true })).toBe(150);
    expect(parseDurationText("1.5h", { compactWhitespace: true })).toBeNull();
  });

  it("keeps decimal duration preview input separate from server validation", () => {
    expect(parseDurationText("2h 30m", { allowDecimal: true })).toBe(150);
    expect(parseDurationText("1.5h", { allowDecimal: true })).toBe(90);
    expect(parseDurationText("1.5", { allowDecimal: true })).toBe(1.5);
    expect(parseDurationText("1x30m", { allowDecimal: true })).toBeNull();
  });
});
