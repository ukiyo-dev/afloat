import { describe, expect, it } from "vitest";

import { formatDuration } from "./view-formatters";

describe("formatDuration", () => {
  it("rounds fractional minutes before formatting", () => {
    expect(formatDuration(6.6666666667)).toBe("7m");
    expect(formatDuration(65.6)).toBe("1h 6m");
  });
});
