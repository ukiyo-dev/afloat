import { describe, expect, it } from "vitest";

import { recalibrationRanges } from "./recalibration-ranges";
import { recentSyncRange } from "./recent-sync-range";
import { syncStatusCode } from "./sync-result";

describe("recentSyncRange", () => {
  it("covers 14 days before and after the sync time", () => {
    const range = recentSyncRange(new Date("2026-05-09T12:30:00.000Z"));

    expect(range.startAt.toISOString()).toBe("2026-04-25T12:30:00.000Z");
    expect(range.endAt.toISOString()).toBe("2026-05-23T12:30:00.000Z");
  });
});

describe("syncStatusCode", () => {
  it("maps success to 200", () => {
    expect(syncStatusCode({ status: "succeeded", kind: "recent", message: "ok" })).toBe(200);
  });

  it("maps missing configuration to 409", () => {
    expect(syncStatusCode({ status: "not_configured", kind: "recent", message: "missing" })).toBe(
      409
    );
  });

  it("maps provider failures to 502", () => {
    expect(syncStatusCode({ status: "failed", kind: "recalibrate", message: "failed" })).toBe(502);
  });
});

describe("recalibrationRanges", () => {
  it("expands backward and forward in one-year windows from now", () => {
    const now = new Date("2026-05-09T00:00:00.000Z");
    const ranges = [...recalibrationRanges(now, 2)];

    expect(ranges.map((range) => [range.startAt.toISOString(), range.endAt.toISOString()])).toEqual([
      ["2025-05-09T00:00:00.000Z", "2026-05-09T00:00:00.000Z"],
      ["2024-05-09T00:00:00.000Z", "2025-05-09T00:00:00.000Z"],
      ["2026-05-09T00:00:00.000Z", "2027-05-09T00:00:00.000Z"],
      ["2027-05-09T00:00:00.000Z", "2028-05-09T00:00:00.000Z"]
    ]);
  });
});
