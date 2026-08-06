import { describe, expect, it } from "vitest";

import {
  commitmentStats,
  sumMinutes,
  totalMinutesByKind
} from "./commitment-stats";

describe("commitmentStats", () => {
  it("clips plans and observed facts to their independent ranges", () => {
    const plans = [segment("2026-05-07T00:00:00Z", "2026-05-07T02:00:00Z", "ideal")];
    const facts = [
      segment("2026-05-07T00:00:00Z", "2026-05-07T01:30:00Z", "idealFulfilled"),
      segment("2026-05-07T00:45:00Z", "2026-05-07T01:15:00Z", "externalShift")
    ];

    expect(
      commitmentStats(plans, facts, {
        planRange: range("2026-05-07T00:30:00Z", "2026-05-07T01:30:00Z"),
        observedRange: range("2026-05-07T00:30:00Z", "2026-05-07T01:00:00Z")
      })
    ).toEqual({
      plannedMinutes: 60,
      fulfilledPlanMinutes: 30,
      fulfillmentRate: 0.5,
      internalFulfilledPlanMinutes: 45,
      internalFulfillmentRate: 0.75
    });
  });

  it("returns no observed minutes when the observed range is null", () => {
    const plans = [segment("2026-05-07T00:00:00Z", "2026-05-07T01:00:00Z", "ideal")];
    const facts = [segment("2026-05-07T00:00:00Z", "2026-05-07T01:00:00Z", "idealFulfilled")];

    expect(commitmentStats(plans, facts, { observedRange: null })).toMatchObject({
      plannedMinutes: 60,
      fulfilledPlanMinutes: 0,
      internalFulfilledPlanMinutes: 0,
      fulfillmentRate: 0,
      internalFulfillmentRate: 0
    });
    expect(totalMinutesByKind(facts, null)).toEqual({});
    expect(sumMinutes(plans)).toBe(60);
  });
});

function range(startAt: string, endAt: string) {
  return { startAt: new Date(startAt), endAt: new Date(endAt) };
}

function segment(startAt: string, endAt: string, kind: string) {
  return { startAt, endAt, kind };
}
