import type { DerivedViewInput } from "./derived-view";

export function sampleInput(now = new Date("2026-05-07T12:00:00.000Z")): DerivedViewInput {
  return {
    now,
    calendarSources: [
      { id: "cal-ideal", name: "理想", semantic: "ideal" },
      { id: "cal-leisure", name: "娱乐", semantic: "leisure" },
      { id: "cal-rest", name: "休息", semantic: "rest" },
      { id: "cal-internal", name: "内部偏移", semantic: "internalShift" }
    ],
    rawEvents: [
      event("e1", "cal-ideal", "Afloat：领域规则 1", "2026-05-06T20:00:00Z", "2026-05-06T22:00:00Z"),
      event("e2", "cal-internal", "刷手机", "2026-05-06T20:30:00Z", "2026-05-06T21:00:00Z"),
      event("e3", "cal-rest", "睡眠", "2026-05-06T23:30:00Z", "2026-05-07T07:30:00Z"),
      event("e4", "cal-leisure", "游戏开发：玩同类游戏 1", "2026-05-07T09:00:00Z", "2026-05-07T10:00:00Z"),
      event("e5", "cal-ideal", "Afloat：领域规则 2", "2026-05-09T10:00:00Z", "2026-05-09T12:00:00Z")
    ],
    threadDeclarations: [
      {
        id: "t1",
        group: "Afloat",
        item: "领域规则",
        expectedMinutes: 360,
        deadline: new Date("2026-05-15T00:00:00Z")
      },
      {
        id: "t2",
        group: "写作",
        item: "小说",
        expectedMinutes: 120,
        deadline: new Date("2026-05-20T00:00:00Z")
      }
    ],
    notes: [
      {
        id: "n1",
        date: "2026-05-06",
        visibility: "private",
        body: "内部偏移覆盖了半小时，事实层应保留原始承诺与偏移。"
      },
      {
        id: "n2",
        date: "2026-05-07",
        visibility: "public",
        body: "今天访客模式复用镜像界面，只隐藏 Threads。"
      }
    ]
  };
}

function event(
  id: string,
  calendarSourceId: string,
  title: string,
  startAt: string,
  endAt: string
) {
  return {
    id,
    calendarSourceId,
    title,
    startAt: new Date(startAt),
    endAt: new Date(endAt)
  };
}
