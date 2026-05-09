import { describe, expect, it } from "vitest";

import { parseCalendarEvents } from "./calendar";
import { buildFactLayer } from "./facts";
import { buildThreadGroupViews, buildThreadViews } from "./threads";
import type { CalendarSource, RawCalendarEvent, ThreadDeclaration } from "./types";

const sources: CalendarSource[] = [
  { id: "ideal", name: "理想", semantic: "ideal" },
  { id: "rest", name: "休息", semantic: "rest" },
  { id: "internal", name: "内部偏移", semantic: "internalShift" }
];

describe("buildThreadViews", () => {
  it("tracks fulfilled minutes only from fact segments and keeps empty declared threads deletable", () => {
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "p1",
        calendarSourceId: "ideal",
        title: "Afloat：MVP 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T22:00:00Z")
      },
      {
        id: "s1",
        calendarSourceId: "internal",
        title: "刷手机",
        startAt: new Date("2026-05-01T21:00:00Z"),
        endAt: new Date("2026-05-01T21:30:00Z")
      },
      {
        id: "p2",
        calendarSourceId: "ideal",
        title: "Afloat：MVP 2",
        startAt: new Date("2026-05-10T20:00:00Z"),
        endAt: new Date("2026-05-10T21:00:00Z")
      }
    ];
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "MVP",
        expectedMinutes: 240,
        deadline: new Date("2026-05-12T00:00:00Z")
      },
      {
        id: "t2",
        group: "写作",
        item: "小说",
        expectedMinutes: 120,
        deadline: new Date("2026-05-12T00:00:00Z")
      }
    ];

    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    const afloat = threads.find((thread) => thread.group === "Afloat");
    const writing = threads.find((thread) => thread.group === "写作");

    expect(afloat).toMatchObject({
      key: "Afloat/MVP",
      fulfilledMinutes: 90,
      futureMinutes: 60,
      factGapMinutes: 150,
      unscheduledGapMinutes: 90,
      source: "both",
      closed: false
    });
    expect(afloat?.history).toEqual([
      expect.objectContaining({
        source: "futurePlan",
        kind: "ideal",
        minutes: 60,
        title: "Afloat：MVP 2"
      }),
      expect.objectContaining({
        source: "fact",
        kind: "idealFulfilled",
        minutes: 30,
        title: "Afloat：MVP 1"
      }),
      expect.objectContaining({
        source: "fact",
        kind: "idealFulfilled",
        minutes: 60,
        title: "Afloat：MVP 1"
      })
    ]);
    expect(writing).toMatchObject({
      key: "%E5%86%99%E4%BD%9C/%E5%B0%8F%E8%AF%B4",
      fulfilledMinutes: 0,
      futureMinutes: 0,
      canDelete: true,
      source: "declared",
      closed: false
    });
    expect(JSON.stringify(threads)).not.toContain("\\u0000");
  });

  it("marks a sequenced thread closed when a later unnumbered plan event is still future", () => {
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "p1",
        calendarSourceId: "ideal",
        title: "写作：小说 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T21:00:00Z")
      },
      {
        id: "p2",
        calendarSourceId: "ideal",
        title: "写作：小说",
        startAt: new Date("2026-05-10T20:00:00Z"),
        endAt: new Date("2026-05-10T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations: [],
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    expect(threads[0]).toMatchObject({
      group: "写作",
      item: "小说",
      closed: true
    });
  });

  it("reopens a closed thread when a later numbered plan event appears", () => {
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "p1",
        calendarSourceId: "ideal",
        title: "写作：小说 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T21:00:00Z")
      },
      {
        id: "p2",
        calendarSourceId: "ideal",
        title: "写作：小说",
        startAt: new Date("2026-05-02T20:00:00Z"),
        endAt: new Date("2026-05-02T21:00:00Z")
      },
      {
        id: "p3",
        calendarSourceId: "ideal",
        title: "写作：小说 1",
        startAt: new Date("2026-05-03T20:00:00Z"),
        endAt: new Date("2026-05-03T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations: [],
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    expect(threads[0]).toMatchObject({
      group: "写作",
      item: "小说",
      closed: false
    });
  });

  it("releases an auto group after every active item is closed by historical unnumbered plans", () => {
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "p1",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T21:00:00Z")
      },
      {
        id: "p2",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环",
        startAt: new Date("2026-05-02T20:00:00Z"),
        endAt: new Date("2026-05-02T21:00:00Z")
      },
      {
        id: "p3",
        calendarSourceId: "ideal",
        title: "Afloat：公开页 1",
        startAt: new Date("2026-05-03T20:00:00Z"),
        endAt: new Date("2026-05-03T21:00:00Z")
      },
      {
        id: "p4",
        calendarSourceId: "ideal",
        title: "Afloat：公开页",
        startAt: new Date("2026-05-04T20:00:00Z"),
        endAt: new Date("2026-05-04T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations: [],
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    expect(threads.filter((thread) => thread.group === "Afloat")).toEqual([]);
  });

  it("treats a same-name group after release as a new active generation", () => {
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "old-seq",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T21:00:00Z")
      },
      {
        id: "old-close",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环",
        startAt: new Date("2026-05-02T20:00:00Z"),
        endAt: new Date("2026-05-02T21:00:00Z")
      },
      {
        id: "new-seq",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环 1",
        startAt: new Date("2026-05-05T20:00:00Z"),
        endAt: new Date("2026-05-05T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations: [],
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    const thread = threads.find((item) => item.group === "Afloat" && item.item === "同步闭环");
    expect(thread).toMatchObject({
      closed: false,
      fulfilledMinutes: 60
    });
    expect(thread?.history).toEqual([
      expect.objectContaining({
        title: "Afloat：同步闭环 1",
        startAt: "2026-05-05T20:00:00.000Z"
      })
    ]);
  });

  it("requires declared empty items to be closed before releasing their group", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "manual",
        group: "Afloat",
        item: "手动项",
        expectedMinutes: null,
        deadline: null,
        createdAt: new Date("2026-05-01T12:00:00Z")
      }
    ];
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "seq",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环 1",
        startAt: new Date("2026-05-02T20:00:00Z"),
        endAt: new Date("2026-05-02T21:00:00Z")
      },
      {
        id: "close-auto",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环",
        startAt: new Date("2026-05-03T20:00:00Z"),
        endAt: new Date("2026-05-03T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    expect(threads.map((thread) => thread.item).sort()).toEqual(["同步闭环", "手动项"]);
  });

  it("releases a group only after declared empty items also receive historical unnumbered plans", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "manual",
        group: "Afloat",
        item: "手动项",
        expectedMinutes: null,
        deadline: null,
        createdAt: new Date("2026-05-01T12:00:00Z")
      }
    ];
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "seq",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环 1",
        startAt: new Date("2026-05-02T20:00:00Z"),
        endAt: new Date("2026-05-02T21:00:00Z")
      },
      {
        id: "close-auto",
        calendarSourceId: "ideal",
        title: "Afloat：同步闭环",
        startAt: new Date("2026-05-03T20:00:00Z"),
        endAt: new Date("2026-05-03T21:00:00Z")
      },
      {
        id: "close-manual",
        calendarSourceId: "ideal",
        title: "Afloat：手动项",
        startAt: new Date("2026-05-04T20:00:00Z"),
        endAt: new Date("2026-05-04T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    expect(threads.filter((thread) => thread.group === "Afloat")).toEqual([]);
  });

  it("aggregates item-level expected minutes and deadlines into group views", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "同步",
        expectedMinutes: 120,
        deadline: new Date("2026-05-12T00:00:00Z")
      },
      {
        id: "t2",
        group: "Afloat",
        item: "公开页",
        expectedMinutes: 240,
        deadline: new Date("2026-05-20T00:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, []);
    const factLayer = buildFactLayer(parsedEvents);
    const now = new Date("2026-05-07T12:00:00Z");
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now
    });
    const groups = buildThreadGroupViews(threads, now);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      group: "Afloat",
      expectedMinutes: 360,
      deadline: "2026-05-20",
      factGapMinutes: 360,
      unscheduledGapMinutes: 360
    });
    expect(groups[0]?.items.map((item) => item.item).sort()).toEqual(["公开页", "同步"]);
  });

  it("sums group gaps from per-item non-negative gaps", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "同步",
        expectedMinutes: 60,
        deadline: new Date("2026-05-12T00:00:00Z")
      },
      {
        id: "t2",
        group: "Afloat",
        item: "公开页",
        expectedMinutes: 120,
        deadline: new Date("2026-05-12T00:00:00Z")
      }
    ];
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "sync-done",
        calendarSourceId: "ideal",
        title: "Afloat：同步 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T22:00:00Z")
      },
      {
        id: "page-plan",
        calendarSourceId: "ideal",
        title: "Afloat：公开页 1",
        startAt: new Date("2026-05-10T20:00:00Z"),
        endAt: new Date("2026-05-10T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const now = new Date("2026-05-07T12:00:00Z");
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now
    });
    const groups = buildThreadGroupViews(threads, now);

    expect(groups[0]).toMatchObject({
      expectedMinutes: 180,
      fulfilledMinutes: 120,
      futureMinutes: 60,
      factGapMinutes: 120,
      unscheduledGapMinutes: 60,
      planCoverageRate: 0.5
    });
  });

  it("calculates group plan coverage from per-item capped future coverage", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "同步",
        expectedMinutes: 60,
        deadline: new Date("2026-05-12T00:00:00Z")
      },
      {
        id: "t2",
        group: "Afloat",
        item: "公开页",
        expectedMinutes: 120,
        deadline: new Date("2026-05-12T00:00:00Z")
      }
    ];
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "sync-future",
        calendarSourceId: "ideal",
        title: "Afloat：同步 1",
        startAt: new Date("2026-05-10T20:00:00Z"),
        endAt: new Date("2026-05-10T22:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const now = new Date("2026-05-07T12:00:00Z");
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now
    });
    const groups = buildThreadGroupViews(threads, now);

    expect(groups[0]).toMatchObject({
      futureMinutes: 120,
      factGapMinutes: 180,
      unscheduledGapMinutes: 120,
      planCoverageRate: 1 / 3
    });
  });

  it("sums group daily required minutes from item daily requirements", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "同步",
        expectedMinutes: 60,
        deadline: new Date("2026-05-09T00:00:00Z")
      },
      {
        id: "t2",
        group: "Afloat",
        item: "公开页",
        expectedMinutes: 120,
        deadline: new Date("2026-05-11T00:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, []);
    const factLayer = buildFactLayer(parsedEvents);
    const now = new Date("2026-05-07T12:00:00Z");
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now
    });
    const groups = buildThreadGroupViews(threads, now);

    expect(groups[0]?.dailyRequiredMinutes).toBe(60);
  });

  it("does not mark an item fulfilled only because done exceeds target", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "同步",
        expectedMinutes: 60,
        deadline: new Date("2026-05-12T00:00:00Z")
      }
    ];
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "sync-done",
        calendarSourceId: "ideal",
        title: "Afloat：同步 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T22:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    expect(threads[0]).toMatchObject({
      fulfilledMinutes: 120,
      factGapMinutes: 0,
      unscheduledGapMinutes: 0,
      status: "scheduled"
    });
  });

  it("marks an item fulfilled when its unnumbered closing plan is historical", () => {
    const declarations: ThreadDeclaration[] = [
      {
        id: "t1",
        group: "Afloat",
        item: "同步",
        expectedMinutes: 180,
        deadline: new Date("2026-05-12T00:00:00Z")
      },
      {
        id: "t2",
        group: "Afloat",
        item: "未关闭项",
        expectedMinutes: null,
        deadline: null,
        createdAt: new Date("2026-05-01T00:00:00Z")
      }
    ];
    const rawEvents: RawCalendarEvent[] = [
      {
        id: "sync-done",
        calendarSourceId: "ideal",
        title: "Afloat：同步 1",
        startAt: new Date("2026-05-01T20:00:00Z"),
        endAt: new Date("2026-05-01T21:00:00Z")
      },
      {
        id: "sync-close",
        calendarSourceId: "ideal",
        title: "Afloat：同步",
        startAt: new Date("2026-05-02T20:00:00Z"),
        endAt: new Date("2026-05-02T21:00:00Z")
      }
    ];
    const parsedEvents = parseCalendarEvents(sources, rawEvents);
    const factLayer = buildFactLayer(parsedEvents);
    const threads = buildThreadViews({
      declarations,
      facts: factLayer.facts,
      cleanPlanSegments: factLayer.cleanPlanSegments,
      parsedEvents,
      now: new Date("2026-05-07T12:00:00Z")
    });

    const thread = threads.find((item) => item.item === "同步");
    expect(thread).toMatchObject({
      fulfilledMinutes: 120,
      factGapMinutes: 0,
      unscheduledGapMinutes: 0,
      status: "fulfilled"
    });
  });
});
