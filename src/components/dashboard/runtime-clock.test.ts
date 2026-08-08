import { describe, expect, it } from "vitest";

import { millisecondsUntilNextMinute, minuteNowIso } from "./runtime-clock";

describe("runtime clock", () => {
  it("normalizes runtime now to the start of its minute", () => {
    expect(minuteNowIso(new Date("2026-08-08T02:24:59.999Z"))).toBe("2026-08-08T02:24:00.000Z");
  });

  it("schedules the next tick at the next minute boundary", () => {
    expect(millisecondsUntilNextMinute(Date.parse("2026-08-08T02:24:12.345Z"))).toBe(47_655);
    expect(millisecondsUntilNextMinute(Date.parse("2026-08-08T02:24:00.000Z"))).toBe(60_000);
  });
});
