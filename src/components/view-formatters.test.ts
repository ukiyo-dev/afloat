import { describe, expect, it } from "vitest";

import { formatDuration, timeRange, timelineTimeRange } from "./view-formatters";

describe("formatDuration", () => {
  it("rounds fractional minutes before formatting", () => {
    expect(formatDuration(6.6666666667)).toBe("7m");
    expect(formatDuration(65.6)).toBe("1h 6m");
  });
});

describe("timeRange", () => {
  it("formats both clock values in the configured timezone", () => {
    expect(
      timeRange(
        "2026-05-07T20:00:00.000Z",
        "2026-05-07T21:30:00.000Z",
        "UTC"
      )
    ).toBe("20:00-21:30");
  });

  it("falls back for the whole range when either value is invalid", () => {
    expect(
      timeRange(
        "2026-05-07Txx:yy:00.000Z",
        "2026-05-07T21:30:00.000Z",
        "UTC"
      )
    ).toBe("xx:yy-21:30");
  });

  it("falls back when the configured timezone is invalid", () => {
    expect(
      timeRange(
        "2026-05-07T20:00:00.000Z",
        "2026-05-07T21:30:00.000Z",
        "Not/A_Timezone"
      )
    ).toBe("20:00-21:30");
  });
});

describe("timelineTimeRange", () => {
  it("marks starts before the reference day on the left", () => {
    expect(
      timelineTimeRange(
        "2026-05-05T23:30:00.000Z",
        "2026-05-07T07:30:00.000Z",
        "UTC",
        "2026-05-07"
      )
    ).toMatchObject({
      startTime: "23:30",
      endTime: "07:30",
      startDayOffset: -2,
      endDayOffset: 0
    });
  });

  it("marks ends after the reference day on the right", () => {
    expect(
      timelineTimeRange(
        "2026-05-07T22:00:00.000Z",
        "2026-05-08T01:00:00.000Z",
        "UTC",
        "2026-05-07"
      )
    ).toMatchObject({
      startDayOffset: 0,
      endDayOffset: 1
    });
  });

  it("uses the configured timezone for local day offsets", () => {
    expect(
      timelineTimeRange(
        "2026-05-07T06:30:00.000Z",
        "2026-05-08T07:30:00.000Z",
        "America/Los_Angeles",
        "2026-05-07"
      )
    ).toMatchObject({
      startTime: "23:30",
      endTime: "00:30",
      startDayOffset: -1,
      endDayOffset: 1
    });
  });
});
