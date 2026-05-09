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
        defaultDashboardRange: "day",
        timezone: "Asia/Shanghai"
      })
    ).not.toThrow();
    expect(() =>
      validateDashboardSettings({
        publicPageEnabled: true,
        defaultDashboardRange: "7d",
        timezone: "Bad/Zone"
      })
    ).toThrow("timezone is invalid");
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
