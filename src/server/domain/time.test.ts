import { describe, expect, it } from "vitest";
import {
  addDateKeyDays,
  calendarDayDifference,
  inclusiveCalendarDays,
  localDayRange,
  localDayKeyFromValue,
  minutesInRange
} from "./time";

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

describe("calendar date helpers", () => {
  it("moves date keys across month and year boundaries", () => {
    expect(addDateKeyDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDateKeyDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("counts inclusive calendar days without time-zone drift", () => {
    expect(calendarDayDifference("2026-07-01", "2026-07-03")).toBe(2);
    expect(inclusiveCalendarDays("2026-07-01", "2026-07-03")).toBe(3);
    expect(inclusiveCalendarDays("2026-07-03", "2026-07-01")).toBe(0);
  });

  it("derives local dates from timestamp values", () => {
    expect(localDayKeyFromValue("2026-07-01T23:30:00.000Z", "Asia/Shanghai")).toBe("2026-07-02");
  });
});
