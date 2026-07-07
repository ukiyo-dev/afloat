import { describe, expect, it } from "vitest";

import {
  validateNote,
  validateNoteDate,
  validateDashboardSettings,
  validateThreadDeclaration
} from "./workbench-validation";

describe("workbench validation", () => {
  it("validates notes", () => {
    expect(() =>
      validateNote({ date: "2026-05-07", body: "今日解释", visibility: "public" })
    ).not.toThrow();
    expect(() => validateNote({ date: "2026/05/07", body: "x", visibility: "private" })).toThrow(
      "date must be YYYY-MM-DD"
    );
  });

  it("validates note deletion dates", () => {
    expect(() => validateNoteDate("2026-05-07")).not.toThrow();
    expect(() => validateNoteDate("2026-5-7")).toThrow("date must be YYYY-MM-DD");
  });

  it("validates dashboard settings", () => {
    expect(() =>
      validateDashboardSettings({
        publicPageEnabled: true,
        defaultDashboardRange: {
          startOffsetDays: -1,
          endOffsetDays: -1
        },
        timezone: "Asia/Shanghai",
        threadStaleDays: 7
      })
    ).not.toThrow();
    expect(() =>
      validateDashboardSettings({
        publicPageEnabled: true,
        defaultDashboardRange: {
          startOffsetDays: -7,
          endOffsetDays: -1
        },
        timezone: "Bad/Zone",
        threadStaleDays: 7
      })
    ).toThrow("timezone is invalid");
    expect(() =>
      validateDashboardSettings({
        publicPageEnabled: true,
        defaultDashboardRange: {
          startOffsetDays: 2,
          endOffsetDays: -1
        },
        timezone: "UTC",
        threadStaleDays: 7
      })
    ).toThrow("defaultDashboardRange must be in ascending order");
    expect(() =>
      validateDashboardSettings({
        publicPageEnabled: true,
        defaultDashboardRange: {
          startOffsetDays: 0,
          endOffsetDays: 0
        },
        timezone: "UTC",
        threadStaleDays: 0
      })
    ).toThrow("threadStaleDays must be a positive integer");
  });

  it("validates thread declarations", () => {
    expect(() =>
      validateThreadDeclaration({
        group: "Afloat",
        item: "同步闭环",
        expectedMinutes: 120,
        deadline: new Date("2026-05-15T00:00:00.000Z")
      })
    ).not.toThrow();
    expect(() =>
      validateThreadDeclaration({
        group: "",
        item: "同步闭环",
        expectedMinutes: null,
        deadline: null
      })
    ).toThrow("group and item are required");
  });
});
