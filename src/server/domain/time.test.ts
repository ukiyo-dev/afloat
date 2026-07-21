import { describe, expect, it } from "vitest";
import { localDayRange, minutesInRange } from "./time";

describe("localDayRange", () => {
  it("returns local midnight boundaries in UTC", () => {
    expect(localDayRange("2026-07-21", "Asia/Shanghai")).toEqual({
      startAt: new Date("2026-07-20T16:00:00.000Z"),
      endAt: new Date("2026-07-21T16:00:00.000Z")
    });
  });

  it("respects daylight-saving day length", () => {
    expect(minutesInRange(localDayRange("2026-03-08", "America/New_York"))).toBe(23 * 60);
  });
});
