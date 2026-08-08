import { describe, expect, it } from "vitest";

import { isThreadInDateRange } from "./thread-range-utils";

describe("isThreadInDateRange", () => {
  it("includes threads whose observation window overlaps the selected range", () => {
    expect(isThreadInDateRange(
      { start: "2026-08-05", deadline: "2026-08-12" },
      "2026-08-10",
      "2026-08-10"
    )).toBe(true);
  });

  it("excludes threads that start after or end before the selected range", () => {
    expect(isThreadInDateRange(
      { start: "2026-08-11", deadline: "2026-08-12" },
      "2026-08-10",
      "2026-08-10"
    )).toBe(false);
    expect(isThreadInDateRange(
      { start: "2026-08-01", deadline: "2026-08-09" },
      "2026-08-10",
      "2026-08-10"
    )).toBe(false);
  });

  it("keeps an open-ended thread active after its start date", () => {
    expect(isThreadInDateRange(
      { start: "2026-08-05", deadline: null },
      "2026-08-10",
      "2026-08-10"
    )).toBe(true);
  });
});
