import { describe, expect, it } from "vitest";

import { parseDurationInput } from "./duration-input";

describe("parseDurationInput", () => {
  it("parses minutes and xhxm duration inputs", () => {
    expect(parseDurationInput("120")).toBe(120);
    expect(parseDurationInput("2h30m")).toBe(150);
    expect(parseDurationInput("2h 30m")).toBe(150);
    expect(parseDurationInput("1h")).toBe(60);
    expect(parseDurationInput("45m")).toBe(45);
    expect(parseDurationInput("")).toBeNull();
  });

  it("rejects invalid duration inputs", () => {
    expect(() => parseDurationInput("1x30m")).toThrow("expectedMinutes");
    expect(() => parseDurationInput("h")).toThrow("expectedMinutes");
  });
});
