import { describe, expect, it } from "vitest";

import {
  isCalendarMappingValue,
  isSemanticKind,
  validateCalendarSourceMapping
} from "./calendar-source-validation";

describe("calendar source validation", () => {
  it("accepts v1 semantic kinds", () => {
    expect(isSemanticKind("ideal")).toBe(true);
    expect(isSemanticKind("internalShift")).toBe(true);
  });

  it("accepts none as a calendar mapping value", () => {
    expect(isCalendarMappingValue("none")).toBe(true);
    expect(() =>
      validateCalendarSourceMapping({
        externalCalendarId: "/calendars/reminders/",
        name: "提醒",
        semantic: "none"
      })
    ).not.toThrow();
  });

  it("rejects unknown semantic kinds", () => {
    expect(isSemanticKind("work")).toBe(false);
    expect(() =>
      validateCalendarSourceMapping({
        externalCalendarId: "/calendars/work/",
        name: "Work",
        semantic: "work"
      })
    ).toThrow("semantic is invalid");
  });

  it("requires calendar identity fields", () => {
    expect(() =>
      validateCalendarSourceMapping({
        externalCalendarId: "",
        name: "理想",
        semantic: "ideal"
      })
    ).toThrow("externalCalendarId is required");
  });
});
