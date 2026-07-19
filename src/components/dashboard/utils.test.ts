import { describe, expect, it } from "vitest";

import { shiftedRangeParams } from "./utils";

describe("dashboard range navigation", () => {
  it("moves a single-day view by one day and keeps day mode", () => {
    expect(shiftedRangeParams("2026-07-19", "2026-07-19", -1)).toEqual({
      range: "day",
      date: "2026-07-18",
      start: null,
      end: null
    });
  });

  it("moves a multi-day view by its full inclusive window", () => {
    expect(shiftedRangeParams("2026-07-13", "2026-07-19", -1)).toEqual({
      range: "custom",
      date: null,
      start: "2026-07-06",
      end: "2026-07-12"
    });
    expect(shiftedRangeParams("2026-07-13", "2026-07-19", 1)).toEqual({
      range: "custom",
      date: null,
      start: "2026-07-20",
      end: "2026-07-26"
    });
  });

  it("preserves custom window length across month boundaries", () => {
    expect(shiftedRangeParams("2026-07-29", "2026-08-02", 1)).toEqual({
      range: "custom",
      date: null,
      start: "2026-08-03",
      end: "2026-08-07"
    });
  });
});
