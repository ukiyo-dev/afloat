import { describe, expect, it } from "vitest";

import {
  clampThreadMinutes,
  shouldShowFactDistributionStat,
  threadFactMinutesByKind,
  threadPlanMinutesByKind
} from "./fact-distribution";

describe("clampThreadMinutes", () => {
  it("does not render attributed future minutes beyond the displayed total", () => {
    expect(clampThreadMinutes(0, 60)).toBe(0);
    expect(clampThreadMinutes(30, 60)).toBe(30);
  });
});

describe("shouldShowFactDistributionStat", () => {
  const futureLeisurePlan = {
    fulfilled: 0,
    plan: 60,
    intShift: 0,
    extShift: 0
  };

  it("does not show a future-only plan in a range that displays facts", () => {
    expect(shouldShowFactDistributionStat(futureLeisurePlan, false)).toBe(false);
  });

  it("shows the same plan in a future plan preview", () => {
    expect(shouldShowFactDistributionStat(futureLeisurePlan, true)).toBe(true);
  });
});

describe("threadFactMinutesByKind", () => {
  it("uses projected thread facts and excludes the remaining future plan", () => {
    expect(threadFactMinutesByKind("2026-08-05T00:00:00.000Z", "2026-08-06T00:00:00.000Z", [
      {
            startAt: "2026-08-05T10:00:00.000Z",
            endAt: "2026-08-05T10:31:00.000Z",
            kind: "idealFulfilled",
            title: "Afloat: Work 1",
            source: "fact",
            sourceEventId: "work-1",
            planEventId: "work-1",
            threadGroup: "Afloat",
            threadItem: "Work 1"
          },
          {
            startAt: "2026-08-05T10:31:00.000Z",
            endAt: "2026-08-05T11:00:00.000Z",
            kind: "ideal",
            title: "Afloat: Work 1",
            source: "futurePlan",
            sourceEventId: "work-1",
            planEventId: "work-1",
            threadGroup: "Afloat",
            threadItem: "Work 1"
          }
    ])).toEqual({
      idealFulfilled: 31
    });
  });

  it("clips projected thread facts to the selected range", () => {
    expect(threadFactMinutesByKind("2026-08-05T00:00:00.000Z", "2026-08-06T00:00:00.000Z", [
      {
          startAt: "2026-08-04T23:45:00.000Z",
          endAt: "2026-08-05T00:15:00.000Z",
          kind: "restFulfilled",
          title: "Afloat: Sleep 1",
          source: "fact",
          sourceEventId: "sleep-1",
          planEventId: "sleep-1",
          threadGroup: "Afloat",
          threadItem: "Sleep 1"
      }
    ])).toEqual({
      restFulfilled: 15
    });
  });
});

describe("threadPlanMinutesByKind", () => {
  it("uses future plan attributions and excludes fulfilled facts", () => {
    expect(threadPlanMinutesByKind("2026-08-05T00:00:00.000Z", "2026-08-06T00:00:00.000Z", [
      {
        startAt: "2026-08-05T10:00:00.000Z",
        endAt: "2026-08-05T10:30:00.000Z",
        kind: "ideal",
        title: "Afloat: Work 1",
        source: "futurePlan",
        sourceEventId: "work-1",
        planEventId: "work-1",
        threadGroup: "Afloat",
        threadItem: "Work 1"
      },
      {
        startAt: "2026-08-05T10:30:00.000Z",
        endAt: "2026-08-05T11:00:00.000Z",
        kind: "idealFulfilled",
        title: "Afloat: Work 1",
        source: "fact",
        sourceEventId: "work-1",
        planEventId: "work-1",
        threadGroup: "Afloat",
        threadItem: "Work 1"
      }
    ])).toEqual({ ideal: 30 });
  });
});
