import { describe, expect, it } from "vitest";

import { buildPersonalRuleView, type PersonalRuleRecord } from "./personal-rules";

const baseRule: PersonalRuleRecord = {
  id: "rule-1",
  title: "00:30 before sleep",
  content: "Awake after 00:30 is a break.",
  startDate: "2026-07-01",
  status: "active",
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  breaks: []
};

describe("personal rule runs", () => {
  it("counts an active run without counting today", () => {
    const view = buildPersonalRuleView(baseRule, "2026-07-03");

    expect(view.currentRunDays).toBe(2);
    expect(view.bestRunDays).toBe(2);
    expect(view.runStatus).toBe("active");
  });

  it("closes the run on a break day and starts a new run on the next day", () => {
    const rule: PersonalRuleRecord = {
      ...baseRule,
      breaks: [
        {
          id: "break-1",
          brokenDate: "2026-07-04",
          scene: "Phone in bed",
          reason: "No cutoff",
          createdAt: "2026-07-04T15:00:00.000Z"
        }
      ]
    };

    const brokenDay = buildPersonalRuleView(rule, "2026-07-04");
    const nextDay = buildPersonalRuleView(rule, "2026-07-05");

    expect(brokenDay.runStatus).toBe("brokenToday");
    expect(brokenDay.currentRunDays).toBe(0);
    expect(brokenDay.bestRunDays).toBe(3);
    expect(nextDay.runStatus).toBe("active");
    expect(nextDay.currentRunStartDate).toBe("2026-07-05");
    expect(nextDay.currentRunDays).toBe(0);
  });

  it("keeps the best closed run after repeated breaks", () => {
    const rule: PersonalRuleRecord = {
      ...baseRule,
      breaks: [
        {
          id: "break-1",
          brokenDate: "2026-07-04",
          scene: "Phone in bed",
          reason: "No cutoff",
          createdAt: "2026-07-04T15:00:00.000Z"
        },
        {
          id: "break-2",
          brokenDate: "2026-07-08",
          scene: "Late coffee",
          reason: "Could not sleep",
          createdAt: "2026-07-08T15:00:00.000Z"
        }
      ]
    };

    const view = buildPersonalRuleView(rule, "2026-07-10");

    expect(view.bestRunDays).toBe(3);
    expect(view.currentRunStartDate).toBe("2026-07-09");
    expect(view.currentRunDays).toBe(1);
    expect(view.breakCount).toBe(2);
  });
});
