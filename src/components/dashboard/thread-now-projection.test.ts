import { describe, expect, it } from "vitest";

import { projectThreadGroupsForNow, projectThreadsForNow } from "./thread-now-projection";

describe("projectThreadsForNow", () => {
  it("does not apply the attention threshold before Start and activates on the Start date", () => {
    const thread = {
      key: "future",
      group: "Future",
      item: "Item",
      activityState: "active" as const,
      source: "declared" as const,
      fulfilledMinutes: 0,
      futureMinutes: 0,
      externalShiftMinutes: 0,
      internalShiftMinutes: 0,
      expectedMinutes: null,
      start: "2026-07-10",
      deadline: null,
      lastActivityAt: "2026-07-10T00:00:00.000Z",
      factGapMinutes: null,
      unscheduledGapMinutes: null,
      planCoverageRate: null,
      dailyRequiredMinutes: null,
      status: "upcoming" as const,
      canDelete: true,
      closed: false,
      sequences: [],
      history: []
    };

    const [beforeStart] = projectThreadsForNow(
      [thread],
      "2026-07-09T23:00:00.000Z",
      "UTC",
      "2026-07-09T00:00:00.000Z",
      7
    );
    const [onStart] = projectThreadsForNow(
      [thread],
      "2026-07-10T23:59:59.000Z",
      "UTC",
      "2026-07-09T00:00:00.000Z",
      7
    );

    expect(beforeStart?.status).toBe("upcoming");
    expect(onStart?.status).toBe("untracked");
  });

  it("marks active items stale when last activity exceeds the configured threshold", () => {
    const [active, inactive] = projectThreadsForNow(
      [
        {
          key: "afloat-active",
          group: "Afloat",
          item: "Active",
          activityState: "active",
          source: "declared",
          fulfilledMinutes: 0,
          futureMinutes: 0,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: null,
          deadline: null,
          lastActivityAt: "2026-06-29T00:00:00.000Z",
          factGapMinutes: null,
          unscheduledGapMinutes: null,
          planCoverageRate: null,
          dailyRequiredMinutes: null,
          status: "untracked",
          canDelete: true,
          closed: false,
          sequences: [],
          history: []
        },
        {
          key: "afloat-inactive",
          group: "Afloat",
          item: "Inactive",
          activityState: "inactive",
          source: "auto",
          fulfilledMinutes: 60,
          futureMinutes: 0,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: null,
          deadline: null,
          lastActivityAt: "2026-06-29T00:00:00.000Z",
          factGapMinutes: null,
          unscheduledGapMinutes: null,
          planCoverageRate: null,
          dailyRequiredMinutes: null,
          status: "fulfilled",
          canDelete: false,
          closed: true,
          sequences: [],
          history: []
        }
      ],
      "2026-07-07T00:00:01.000Z",
      "UTC",
      "2026-07-07T00:00:00.000Z",
      7
    );

    expect(active?.status).toBe("stale");
    expect(inactive?.status).toBe("fulfilled");
  });

  it("still evaluates stale state when runtime now has not advanced past generatedAt", () => {
    const [thread] = projectThreadsForNow(
      [
        {
          key: "afloat-active",
          group: "Afloat",
          item: "Active",
          activityState: "active",
          source: "declared",
          fulfilledMinutes: 0,
          futureMinutes: 0,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: null,
          deadline: null,
          lastActivityAt: "2026-06-29T00:00:00.000Z",
          factGapMinutes: null,
          unscheduledGapMinutes: null,
          planCoverageRate: null,
          dailyRequiredMinutes: null,
          status: "untracked",
          canDelete: true,
          closed: false,
          sequences: [],
          history: []
        }
      ],
      "2026-07-07T00:00:00.000Z",
      "UTC",
      "2026-07-07T00:00:00.000Z",
      7
    );

    expect(thread?.status).toBe("stale");
  });

  it("moves elapsed future plan minutes into fulfilled minutes without server recompute", () => {
    const [thread] = projectThreadsForNow(
      [
        {
          key: "afloat-sync",
          group: "Afloat",
          item: "Sync",
          source: "auto",
          fulfilledMinutes: 30,
          futureMinutes: 120,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: 180,
          deadline: "2026-07-10",
          factGapMinutes: 150,
          unscheduledGapMinutes: 30,
          planCoverageRate: 0.8,
          dailyRequiredMinutes: 6,
          status: "needsScheduling",
          canDelete: false,
          closed: false,
          sequences: [1],
          history: [
            {
              startAt: "2026-07-05T10:00:00.000Z",
              endAt: "2026-07-05T12:00:00.000Z",
              kind: "ideal",
              minutes: 120,
              title: "Afloat: Sync 1",
              source: "futurePlan"
            }
          ]
        }
      ],
      "2026-07-05T10:30:00.000Z",
      "UTC",
      "2026-07-05T10:00:00.000Z"
    );

    expect(thread?.fulfilledMinutes).toBe(60);
    expect(thread?.futureMinutes).toBe(90);
    expect(thread?.factGapMinutes).toBe(120);
    expect(thread?.unscheduledGapMinutes).toBe(30);
    expect(thread?.history).toEqual([
      {
        startAt: "2026-07-05T10:30:00.000Z",
        endAt: "2026-07-05T12:00:00.000Z",
        kind: "ideal",
        minutes: 90,
        title: "Afloat: Sync 1",
        source: "futurePlan"
      },
      {
        startAt: "2026-07-05T10:00:00.000Z",
        endAt: "2026-07-05T10:30:00.000Z",
        kind: "idealFulfilled",
        minutes: 30,
        title: "Afloat: Sync 1",
        source: "fact"
      }
    ]);
  });

  it("projects group totals from projected thread values", () => {
    const [group] = projectThreadGroupsForNow(
      [
        {
          key: "afloat-sync",
          group: "Afloat",
          item: "Sync",
          source: "auto",
          fulfilledMinutes: 0,
          futureMinutes: 60,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: 60,
          deadline: null,
          factGapMinutes: 60,
          unscheduledGapMinutes: 0,
          planCoverageRate: 1,
          dailyRequiredMinutes: null,
          status: "scheduled",
          canDelete: false,
          closed: false,
          sequences: [1],
          history: [
            {
              startAt: "2026-07-05T10:00:00.000Z",
              endAt: "2026-07-05T11:00:00.000Z",
              kind: "leisure",
              minutes: 60,
              title: "Afloat: Sync 1",
              source: "futurePlan"
            }
          ]
        }
      ],
      "2026-07-05T11:00:00.000Z",
      "UTC",
      "2026-07-05T10:00:00.000Z"
    );

    expect(group?.fulfilledMinutes).toBe(60);
    expect(group?.futureMinutes).toBe(0);
    expect(group?.factGapMinutes).toBe(0);
    expect(group?.status).toBe("scheduled");
  });

  it("merges client-projected done with the existing server done for the same title", () => {
    const [thread] = projectThreadsForNow(
      [
        {
          key: "afloat-sync",
          group: "Afloat",
          item: "Sync",
          source: "auto",
          fulfilledMinutes: 30,
          futureMinutes: 90,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: 120,
          deadline: null,
          factGapMinutes: 90,
          unscheduledGapMinutes: 0,
          planCoverageRate: 1,
          dailyRequiredMinutes: null,
          status: "scheduled",
          canDelete: false,
          closed: false,
          sequences: [1],
          history: [
            {
              startAt: "2026-07-05T10:00:00.000Z",
              endAt: "2026-07-05T10:30:00.000Z",
              kind: "idealFulfilled",
              minutes: 30,
              title: "Afloat: Sync 1",
              source: "fact"
            },
            {
              startAt: "2026-07-05T10:30:00.000Z",
              endAt: "2026-07-05T12:00:00.000Z",
              kind: "ideal",
              minutes: 90,
              title: "Afloat: Sync 1",
              source: "futurePlan"
            }
          ]
        }
      ],
      "2026-07-05T11:00:00.000Z",
      "UTC",
      "2026-07-05T10:30:00.000Z"
    );

    expect(thread?.fulfilledMinutes).toBe(60);
    expect(thread?.futureMinutes).toBe(60);
    expect(thread?.history).toEqual([
      {
        startAt: "2026-07-05T11:00:00.000Z",
        endAt: "2026-07-05T12:00:00.000Z",
        kind: "ideal",
        minutes: 60,
        title: "Afloat: Sync 1",
        source: "futurePlan"
      },
      {
        startAt: "2026-07-05T10:00:00.000Z",
        endAt: "2026-07-05T11:00:00.000Z",
        kind: "idealFulfilled",
        minutes: 60,
        title: "Afloat: Sync 1",
        source: "fact"
      }
    ]);
  });

  it("only counts elapsed future minutes after the server generation time", () => {
    const [thread] = projectThreadsForNow(
      [
        {
          key: "afloat-sync",
          group: "Afloat",
          item: "Sync",
          source: "auto",
          fulfilledMinutes: 0,
          futureMinutes: 120,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: 120,
          deadline: null,
          factGapMinutes: 120,
          unscheduledGapMinutes: 0,
          planCoverageRate: 1,
          dailyRequiredMinutes: null,
          status: "scheduled",
          canDelete: false,
          closed: false,
          sequences: [1],
          history: [
            {
              startAt: "2026-07-05T09:00:00.000Z",
              endAt: "2026-07-05T11:00:00.000Z",
              kind: "ideal",
              minutes: 120,
              title: "Afloat: Sync 1",
              source: "futurePlan"
            }
          ]
        }
      ],
      "2026-07-05T10:30:00.000Z",
      "UTC",
      "2026-07-05T10:00:00.000Z"
    );

    expect(thread?.fulfilledMinutes).toBe(30);
    expect(thread?.futureMinutes).toBe(90);
    expect(thread?.history).toEqual([
      {
        startAt: "2026-07-05T10:30:00.000Z",
        endAt: "2026-07-05T11:00:00.000Z",
        kind: "ideal",
        minutes: 30,
        title: "Afloat: Sync 1",
        source: "futurePlan"
      },
      {
        startAt: "2026-07-05T10:00:00.000Z",
        endAt: "2026-07-05T10:30:00.000Z",
        kind: "idealFulfilled",
        minutes: 30,
        title: "Afloat: Sync 1",
        source: "fact"
      }
    ]);
  });

  it("does not mutate source history when adjacent entries are merged across repeated projections", () => {
    const threads = [
      {
        key: "baldr-sky",
        group: "Baldr Sky",
        item: "Baldr Sky",
        source: "both" as const,
        fulfilledMinutes: 59,
        futureMinutes: 316,
        externalShiftMinutes: 0,
        internalShiftMinutes: 0,
        expectedMinutes: 4800,
        deadline: null,
        factGapMinutes: 4741,
        unscheduledGapMinutes: 4425,
        planCoverageRate: 316 / 4741,
        dailyRequiredMinutes: null,
        status: "scheduled" as const,
        canDelete: false,
        closed: false,
        sequences: [1, 2],
        history: [
          {
            startAt: "2026-07-05T13:45:00.000Z",
            endAt: "2026-07-05T14:43:00.000Z",
            kind: "leisureFulfilled",
            minutes: 59,
            title: "Baldr Sky 1",
            source: "fact" as const
          },
          {
            startAt: "2026-07-05T14:43:00.000Z",
            endAt: "2026-07-05T17:30:00.000Z",
            kind: "leisure",
            minutes: 166,
            title: "Baldr Sky 1",
            source: "futurePlan" as const
          },
          {
            startAt: "2026-07-05T19:30:00.000Z",
            endAt: "2026-07-05T22:00:00.000Z",
            kind: "leisure",
            minutes: 150,
            title: "Baldr Sky 2",
            source: "futurePlan" as const
          }
        ]
      }
    ];

    const first = projectThreadsForNow(
      threads,
      "2026-07-05T15:49:00.000Z",
      "UTC",
      "2026-07-05T14:43:00.000Z"
    )[0];
    const second = projectThreadsForNow(
      threads,
      "2026-07-05T15:49:00.000Z",
      "UTC",
      "2026-07-05T14:43:00.000Z"
    )[0];

    expect(threads[0]?.history[0]?.minutes).toBe(59);
    expect(first?.fulfilledMinutes).toBe(125);
    expect(second?.fulfilledMinutes).toBe(125);
    expect(first?.history.find((entry) => entry.source === "fact")?.minutes).toBe(125);
    expect(second?.history.find((entry) => entry.source === "fact")?.minutes).toBe(125);
  });

  it("keeps adjacent repeated untracked activities as separate history entries", () => {
    const [thread] = projectThreadsForNow(
      [
        {
          key: "writing-untracked",
          group: "写作",
          item: "---",
          activityState: "untracked" as const,
          source: "untracked" as const,
          fulfilledMinutes: 120,
          futureMinutes: 0,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: null,
          start: null,
          deadline: null,
          factGapMinutes: null,
          unscheduledGapMinutes: null,
          planCoverageRate: null,
          dailyRequiredMinutes: null,
          status: "untracked" as const,
          canDelete: false,
          closed: false,
          sequences: [],
          history: [
            {
              startAt: "2026-07-05T10:00:00.000Z",
              endAt: "2026-07-05T11:00:00.000Z",
              kind: "idealFulfilled",
              minutes: 60,
              title: "写作：随笔",
              source: "fact" as const
            },
            {
              startAt: "2026-07-05T11:00:00.000Z",
              endAt: "2026-07-05T12:00:00.000Z",
              kind: "idealFulfilled",
              minutes: 60,
              title: "写作：随笔",
              source: "fact" as const
            }
          ]
        }
      ],
      "2026-07-06T00:00:00.000Z",
      "UTC",
      "2026-07-06T00:00:00.000Z"
    );

    expect(thread?.history).toHaveLength(2);
  });

  it("does not create a zero-minute fact projection during the first partial minute", () => {
    const [thread] = projectThreadsForNow(
      [
        {
          key: "afloat-improvements",
          group: "AFLOAT V1",
          item: "改进",
          source: "auto" as const,
          fulfilledMinutes: 0,
          futureMinutes: 30,
          externalShiftMinutes: 0,
          internalShiftMinutes: 0,
          expectedMinutes: null,
          deadline: null,
          factGapMinutes: null,
          unscheduledGapMinutes: null,
          planCoverageRate: null,
          dailyRequiredMinutes: null,
          status: "untracked" as const,
          canDelete: false,
          closed: false,
          sequences: [1],
          history: [
            {
              startAt: "2026-07-20T15:00:00.000Z",
              endAt: "2026-07-20T15:30:00.000Z",
              kind: "ideal",
              minutes: 30,
              title: "AFLOAT V1：改进",
              source: "futurePlan" as const
            }
          ]
        }
      ],
      "2026-07-20T15:00:20.000Z",
      "UTC",
      "2026-07-20T14:59:00.000Z"
    );

    expect(thread?.history).toEqual([
      expect.objectContaining({ source: "futurePlan", minutes: 30 })
    ]);
    expect(thread?.history.some((entry) => entry.source === "fact")).toBe(false);
  });
});
