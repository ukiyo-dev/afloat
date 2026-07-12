import { describe, expect, it } from "vitest";

import { countRuleBreaksInRange, type PersonalRuleView } from "./personal-rules";

describe("countRuleBreaksInRange", () => {
  it("counts only formal breaks whose broken date is in the inclusive range", () => {
    const rules = [{
      breaks: [
        { type: "test_break", brokenDate: "2026-07-02" },
        { type: "rule_break", brokenDate: "2026-07-02" },
        { type: "rule_break", brokenDate: "2026-07-03" },
        { type: "rule_break", brokenDate: "2026-07-04" }
      ]
    }] as PersonalRuleView[];

    expect(countRuleBreaksInRange(rules, "2026-07-02", "2026-07-03")).toBe(2);
  });
});
