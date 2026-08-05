import { describe, expect, it } from "vitest";

import { threadFactMinutesByKind } from "./fact-distribution";

describe("threadFactMinutesByKind", () => {
  it("uses projected thread facts and excludes the remaining future plan", () => {
    expect(threadFactMinutesByKind([
      {
        history: [
          {
            startAt: "2026-08-05T10:00:00.000Z",
            endAt: "2026-08-05T10:31:00.000Z",
            kind: "idealFulfilled",
            minutes: 31,
            title: "Afloat: Work 1",
            source: "fact"
          },
          {
            startAt: "2026-08-05T10:31:00.000Z",
            endAt: "2026-08-05T11:00:00.000Z",
            kind: "ideal",
            minutes: 29,
            title: "Afloat: Work 1",
            source: "futurePlan"
          }
        ]
      }
    ], "2026-08-05T00:00:00.000Z", "2026-08-06T00:00:00.000Z")).toEqual({
      idealFulfilled: 31
    });
  });

  it("clips projected thread facts to the selected range", () => {
    expect(threadFactMinutesByKind([
      {
        history: [{
          startAt: "2026-08-04T23:45:00.000Z",
          endAt: "2026-08-05T00:15:00.000Z",
          kind: "restFulfilled",
          minutes: 30,
          title: "Afloat: Sleep 1",
          source: "fact"
        }]
      }
    ], "2026-08-05T00:00:00.000Z", "2026-08-06T00:00:00.000Z")).toEqual({
      restFulfilled: 15
    });
  });
});
