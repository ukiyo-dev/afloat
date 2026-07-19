import { describe, expect, it } from "vitest";

import { countFulfilledRulesInRange, type PersonalRuleView } from "./personal-rules";

describe("countFulfilledRulesInRange", () => {
  it("counts signed rules without a formal break in the inclusive range", () => {
    const rules = [
      {
        commitment: "signed",
        breaks: [
          { type: "test_break", brokenDate: "2026-07-02" },
          { type: "rule_break", brokenDate: "2026-07-04" }
        ]
      },
      {
        commitment: "signed",
        breaks: [
          { type: "rule_break", brokenDate: "2026-07-02" },
          { type: "rule_break", brokenDate: "2026-07-03" }
        ]
      },
      {
        commitment: "test",
        breaks: []
      }
    ] as PersonalRuleView[];

    expect(countFulfilledRulesInRange(rules, "2026-07-02", "2026-07-03")).toBe(1);
  });
});
