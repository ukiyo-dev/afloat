import {
  dayKey,
  inclusiveCalendarDays,
  intersection,
  localDateFromKey,
  localDayKey,
  localMidnightToUtc,
  minutesInRange
} from "./time";
import { isFulfilledKind } from "./semantic-kinds";
import {
  compareActiveThreadSchedule,
  deadlineRank,
  statusRank,
  startRank,
  summarizeThreadGroup,
  threadIdentityKey
} from "./thread-summary";
import type {
  FactSegment,
  FeasibilityStatus,
  ParsedEvent,
  ParsedTitle,
  ThreadDeclaration,
  ThreadGroupView,
  ThreadSource,
  ThreadView,
  TimeSegment
} from "./types";

interface ThreadAccumulator {
  group: string;
  item: string;
  activityState: "active" | "inactive" | "untracked";
  declared: boolean;
  auto: boolean;
  declaration?: ThreadDeclaration;
  generationStartAt?: Date;
  windows: Array<{ startAt: Date; endAt?: Date }>;
  fulfilledMinutes: number;
  futureMinutes: number;
  externalShiftMinutes: number;
  internalShiftMinutes: number;
  closed: boolean;
  sequences: Set<number>;
  currentInstance: number;
  activityCount: number;
  history: Array<{
    startAt: Date;
    endAt: Date;
    kind: string;
    minutes: number;
    title: string;
    source: "fact" | "futurePlan";
    threadInstance?: number;
    activitySequence?: number;
  }>;
}

type ThreadTimelineEntry =
  | { type: "declaration"; at: Date; declaration: ThreadDeclaration }
  | { type: "plan"; at: Date; event: ParsedEvent };

export function buildThreadViews(input: {
  declarations: ThreadDeclaration[];
  facts: FactSegment[];
  cleanPlanSegments: TimeSegment[];
  parsedEvents: ParsedEvent[];
  now: Date;
  timezone?: string;
}): ThreadView[] {
  const activeThreads = new Map<string, ThreadAccumulator>();
  const untrackedThreads = new Map<string, ThreadAccumulator>();
  const untrackedPlanEventIds = new Set<string>();
  const activityIdentityByPlanEventId = new Map<
    string,
    { threadInstance: number; activitySequence: number }
  >();
  const activeKeysByGroup = new Map<string, Set<string>>();
  const timeline = buildThreadTimeline(
    input.declarations,
    input.parsedEvents,
    input.timezone ?? "UTC"
  );

  for (const entry of timeline) {
    if (entry.type === "declaration") {
      const declaration = entry.declaration;
      const key = threadIdentityKey(declaration.group, declaration.item);
      const thread = ensureThread(activeThreads, declaration.group, declaration.item, "active");
      const declarationDayStart = localDayStart(entry.at, input.timezone ?? "UTC");
      thread.declared = true;
      thread.declaration = declaration;
      thread.generationStartAt ??= declarationDayStart;
      ensureOpenWindow(thread, declarationDayStart);
      ensureSet(activeKeysByGroup, declaration.group).add(key);
      continue;
    }

    const event = entry.event;
    const key = threadIdentityKey(event.title.group, event.title.item);
    if (event.title.item === "---") {
      untrackedPlanEventIds.add(event.id);
      continue;
    }

    const existingThread = activeThreads.get(key);
    if (!event.title.threadStart && !existingThread) {
      const hasExplicitGroupItem = event.title.titleBody.includes("：");
      if (hasExplicitGroupItem) {
        untrackedPlanEventIds.add(event.id);
      }
      continue;
    }

    const thread = existingThread ?? ensureThread(activeThreads, event.title.group, event.title.item, "active");
    if (event.title.threadStart) {
      thread.currentInstance += 1;
      thread.activityCount = 0;
      thread.auto = true;
    }
    if (thread.currentInstance === 0) {
      thread.currentInstance = 1;
    }
    thread.activityCount += 1;
    thread.closed = false;
    thread.generationStartAt ??= event.startAt;
    ensureOpenWindow(thread, event.startAt);
    if (event.title.sequence !== null) {
      thread.sequences.add(event.title.sequence);
    }
    activityIdentityByPlanEventId.set(event.id, {
      threadInstance: thread.currentInstance,
      activitySequence: thread.activityCount
    });
    ensureSet(activeKeysByGroup, event.title.group).add(key);
  }

  const threadAccumulators = [...activeThreads.values()];
  const trackedGroups = new Set(threadAccumulators.map((thread) => thread.group));
  for (const fact of input.facts) {
    if (fact.startAt >= input.now) {
      continue;
    }

    const attributions = factAttributions(fact, input.cleanPlanSegments);

    for (const attribution of attributions) {
      if (!attribution.planEventId || !untrackedPlanEventIds.has(attribution.planEventId)) {
        continue;
      }
      if (!trackedGroups.has(attribution.threadTitle.group)) {
        continue;
      }
      const thread = ensureThread(
        untrackedThreads,
        attribution.threadTitle.group,
        "---",
        "untracked"
      );
      const historicalRange = rangeBeforeNow(attribution.range, input.now);
      if (historicalRange) {
        addFactRange(thread, fact, historicalRange);
      }
    }

    for (const attribution of attributions) {
      const matchingThreads = threadAccumulators.filter(
        (thread) =>
          thread.group === attribution.threadTitle.group &&
          thread.item === attribution.threadTitle.item
      );

      for (const thread of matchingThreads) {
        const ranges = rangesInThreadWindows(thread, attribution.range, input.now);

        for (const range of ranges) {
          addFactRange(
            thread,
            fact,
            range,
            attribution.planEventId
              ? activityIdentityByPlanEventId.get(attribution.planEventId)
              : undefined
          );
        }
      }
    }
  }

  for (const segment of input.cleanPlanSegments) {
    if (segment.endAt <= input.now) {
      continue;
    }

    const key = threadIdentityKey(segment.title.group, segment.title.item);
    if (untrackedPlanEventIds.has(segment.eventId)) {
      if (trackedGroups.has(segment.title.group)) {
        const untrackedThread = ensureThread(
          untrackedThreads,
          segment.title.group,
          "---",
          "untracked"
        );
        addFutureRange(untrackedThread, segment, input.now);
      }
      continue;
    }
    const thread = activeThreads.get(key);
    if (!thread) {
      continue;
    }
    if (thread.activityState === "inactive") {
      continue;
    }

    const range = {
      startAt: new Date(
        Math.max(
          segment.startAt.getTime(),
          input.now.getTime(),
          thread.generationStartAt?.getTime() ?? Number.NEGATIVE_INFINITY
        )
      ),
      endAt: segment.endAt
    };
    if (!isRangeInOpenThreadWindow(thread, range)) {
      continue;
    }
    addFutureRange(
      thread,
      segment,
      input.now,
      range.startAt,
      activityIdentityByPlanEventId.get(segment.eventId)
    );
  }

  const recentDailyCapacity = recentFulfilledDailyCapacity(input.facts, input.now);
  const timezone = input.timezone ?? "UTC";

  return [...threadAccumulators, ...untrackedThreads.values()]
    .map((thread) => toThreadView(thread, input.now, recentDailyCapacity, timezone))
    .sort(compareThreadViews);
}

function rangeBeforeNow(
  range: { startAt: Date; endAt: Date },
  now: Date
): { startAt: Date; endAt: Date } | null {
  const endAt = new Date(Math.min(range.endAt.getTime(), now.getTime()));
  return endAt > range.startAt ? { startAt: range.startAt, endAt } : null;
}

function addFutureRange(
  thread: ThreadAccumulator,
  segment: TimeSegment,
  now: Date,
  effectiveStartAt?: Date,
  activityIdentity?: { threadInstance: number; activitySequence: number }
): void {
  const range = {
    startAt:
      effectiveStartAt ?? new Date(Math.max(segment.startAt.getTime(), now.getTime())),
    endAt: segment.endAt
  };
  if (range.endAt <= range.startAt) {
    return;
  }
  const minutes = minutesInRange(range);
  thread.futureMinutes += minutes;
  thread.history.push({
    ...range,
    kind: segment.kind,
    minutes,
    title: segment.title.rawTitle,
    source: "futurePlan",
    ...activityIdentity
  });
}

export function buildThreadGroupViews(
  threads: ThreadView[],
  now: Date,
  timezone = "UTC"
): ThreadGroupView[] {
  const byGroup = new Map<string, ThreadView[]>();
  for (const thread of threads) {
    byGroup.set(thread.group, [...(byGroup.get(thread.group) ?? []), thread]);
  }

  return [...byGroup.entries()]
    .map(([group, items]) => toThreadGroupView(group, items, now, timezone))
    .sort(compareThreadGroupViews);
}

function ensureThread(
  threads: Map<string, ThreadAccumulator>,
  group: string,
  item: string,
  activityState: "active" | "inactive" | "untracked"
): ThreadAccumulator {
  const key = threadIdentityKey(group, item);
  const existing = threads.get(key);
  if (existing) {
    return existing;
  }

  const created: ThreadAccumulator = {
    group,
    item,
    activityState,
    declared: false,
    auto: false,
    windows: [],
    fulfilledMinutes: 0,
    futureMinutes: 0,
    externalShiftMinutes: 0,
    internalShiftMinutes: 0,
    closed: false,
    sequences: new Set(),
    currentInstance: 0,
    activityCount: 0,
    history: []
  };
  threads.set(key, created);
  return created;
}

function addFactRange(
  thread: ThreadAccumulator,
  fact: FactSegment,
  range: { startAt: Date; endAt: Date },
  activityIdentity?: { threadInstance: number; activitySequence: number }
): void {
  const minutes = minutesInRange(range);
  if (
    fact.kind === "idealFulfilled" ||
    fact.kind === "leisureFulfilled" ||
    fact.kind === "restFulfilled"
  ) {
    thread.fulfilledMinutes += minutes;
  } else if (fact.kind === "externalShift") {
    thread.externalShiftMinutes += minutes;
  } else {
    thread.internalShiftMinutes += minutes;
  }
  thread.history.push({
    ...range,
    kind: fact.kind,
    minutes,
    title: fact.title.rawTitle,
    source: "fact",
    ...activityIdentity
  });
}

function ensureOpenWindow(thread: ThreadAccumulator, startAt: Date): void {
  if (thread.windows.length === 0) {
    thread.windows.push({ startAt });
  }
}

function buildThreadTimeline(
  declarations: ThreadDeclaration[],
  parsedEvents: ParsedEvent[],
  timezone: string
): ThreadTimelineEntry[] {
  const declarationEntries: ThreadTimelineEntry[] = declarations.map((declaration) => ({
    type: "declaration",
    at: declaration.createdAt ?? new Date(0),
    declaration
  }));
  const eventEntries: ThreadTimelineEntry[] = parsedEvents
    .filter((event) => event.layer === "plan")
    .map((event) => ({
      type: "plan",
      at: event.startAt,
      event
    }));

  return [...declarationEntries, ...eventEntries].sort((a, b) => {
    const dayOrder = localDayKey(a.at, timezone).localeCompare(localDayKey(b.at, timezone));
    if (dayOrder !== 0) {
      return dayOrder;
    }

    const rankOrder = timelineEntryRank(a) - timelineEntryRank(b);
    return rankOrder !== 0 ? rankOrder : a.at.getTime() - b.at.getTime();
  });
}

function timelineEntryRank(entry: ThreadTimelineEntry): number {
  return entry.type === "declaration" ? 0 : 1;
}

function localDayStart(date: Date, timezone: string): Date {
  return localMidnightToUtc(localDateFromKey(localDayKey(date, timezone)), timezone);
}

function ensureSet<TKey, TValue>(map: Map<TKey, Set<TValue>>, key: TKey): Set<TValue> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = new Set<TValue>();
  map.set(key, created);
  return created;
}

function toThreadView(
  thread: ThreadAccumulator,
  now: Date,
  recentDailyCapacity: number,
  timezone: string
): ThreadView {
  if (thread.activityState === "untracked") {
    const lastActivityAt = latestFactActivityAt(thread);
    return {
      key: `${publicThreadKey(thread.group, thread.item)}?state=untracked`,
      group: thread.group,
      item: "---",
      activityState: "untracked",
      source: "untracked",
      fulfilledMinutes: thread.fulfilledMinutes,
      futureMinutes: thread.futureMinutes,
      externalShiftMinutes: thread.externalShiftMinutes,
      internalShiftMinutes: thread.internalShiftMinutes,
      expectedMinutes: null,
      steadyDaily: false,
      start: null,
      deadline: null,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      factGapMinutes: null,
      unscheduledGapMinutes: null,
      planCoverageRate: null,
      dailyRequiredMinutes: null,
      remainingDays: null,
      status: "untracked",
      canDelete: false,
      closed: false,
      sequences: [],
      history: thread.history
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
        .map((entry) => ({
          startAt: entry.startAt.toISOString(),
          endAt: entry.endAt.toISOString(),
          kind: entry.kind,
          minutes: entry.minutes,
          title: entry.title,
          source: entry.source,
          threadInstance: entry.threadInstance,
          activitySequence: entry.activitySequence
        }))
    };
  }
  const source: ThreadSource =
    thread.declared && thread.auto ? "both" : thread.declared ? "declared" : "auto";
  const expectedMinutes = thread.declaration?.expectedMinutes ?? null;
  const fallbackStart = thread.declaration?.createdAt ?? thread.generationStartAt ?? now;
  const start = thread.declaration?.start
    ? dayKey(thread.declaration.start)
    : localDayKey(fallbackStart, timezone);
  const deadline = thread.declaration?.deadline ?? null;
  const factGapMinutes =
    expectedMinutes === null ? null : Math.max(0, expectedMinutes - thread.fulfilledMinutes);
  const unscheduledGapMinutes =
    expectedMinutes === null
      ? null
      : Math.max(0, expectedMinutes - thread.fulfilledMinutes - thread.futureMinutes);
  const planCoverageRate =
    factGapMinutes === null || factGapMinutes === 0
      ? null
      : thread.futureMinutes / factGapMinutes;
  const today = localDayKey(now, timezone);
  const deadlineKey = deadline ? dayKey(deadline) : null;
  const daysLeft = deadlineKey
    ? inclusiveCalendarDays(laterDayKey(today, start), deadlineKey)
    : null;
  const dailyRequiredMinutes =
    unscheduledGapMinutes !== null && deadline && daysLeft !== null && daysLeft > 0
      ? unscheduledGapMinutes / daysLeft
      : null;
  const lastActivityAt = latestFactActivityAt(thread);

  return {
    key:
      thread.activityState === "active"
        ? publicThreadKey(thread.group, thread.item)
        : `${publicThreadKey(thread.group, thread.item)}?state=inactive`,
    group: thread.group,
    item: thread.item,
    activityState: thread.activityState,
    source,
    fulfilledMinutes: thread.fulfilledMinutes,
    futureMinutes: thread.futureMinutes,
    externalShiftMinutes: thread.externalShiftMinutes,
    internalShiftMinutes: thread.internalShiftMinutes,
    expectedMinutes,
    steadyDaily: thread.declaration?.steadyDaily ?? false,
    start,
    deadline: deadline ? deadline.toISOString().slice(0, 10) : null,
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    factGapMinutes,
    unscheduledGapMinutes,
    planCoverageRate,
    dailyRequiredMinutes,
    remainingDays: daysLeft,
    status: feasibilityStatus({
      factGapMinutes,
      unscheduledGapMinutes,
      dailyRequiredMinutes,
      start,
      deadline,
      now,
      timezone,
      recentDailyCapacity
    }),
    canDelete:
      thread.declared &&
      !thread.auto &&
      thread.fulfilledMinutes === 0 &&
      thread.futureMinutes === 0 &&
      thread.history.length === 0,
    closed: thread.closed,
    sequences: [...thread.sequences].sort((a, b) => a - b),
    history: thread.history
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
      .map((entry) => ({
        startAt: entry.startAt.toISOString(),
        endAt: entry.endAt.toISOString(),
        kind: entry.kind,
        minutes: entry.minutes,
        title: entry.title,
        source: entry.source,
        threadInstance: entry.threadInstance,
        activitySequence: entry.activitySequence
      }))
  };
}

function factAttributions(
  fact: FactSegment,
  cleanPlanSegments: TimeSegment[]
): Array<{
  threadTitle: ParsedTitle;
  range: { startAt: Date; endAt: Date };
  planEventId?: string;
}> {
  if (fact.kind !== "externalShift" && fact.kind !== "internalShift") {
    return [{ threadTitle: fact.title, range: fact, planEventId: fact.sourceEventId }];
  }

  const coveredRanges = cleanPlanSegments.flatMap((plan) => {
    const range = intersection(fact, plan);
    return range ? [{ threadTitle: plan.title, range, planEventId: plan.eventId }] : [];
  });

  return coveredRanges.length > 0 ? coveredRanges : [{ threadTitle: fact.title, range: fact }];
}

function rangesInThreadWindows(
  thread: ThreadAccumulator,
  range: { startAt: Date; endAt: Date },
  now: Date
): Array<{ startAt: Date; endAt: Date }> {
  return thread.windows.flatMap((window) => {
    const startAt = new Date(Math.max(range.startAt.getTime(), window.startAt.getTime()));
    const endLimit = window.endAt ?? now;
    const endAt = new Date(Math.min(range.endAt.getTime(), endLimit.getTime(), now.getTime()));
    return endAt > startAt ? [{ startAt, endAt }] : [];
  });
}

function isRangeInOpenThreadWindow(
  thread: ThreadAccumulator,
  range: { startAt: Date; endAt: Date }
): boolean {
  const window = thread.windows.at(-1);
  if (!window || window.endAt) {
    return false;
  }
  return range.endAt > window.startAt;
}

function feasibilityStatus(input: {
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  dailyRequiredMinutes: number | null;
  start: string | null;
  deadline: Date | null;
  now: Date;
  timezone: string;
  recentDailyCapacity: number;
}): FeasibilityStatus {
  if (input.start && localDayKey(input.now, input.timezone) < input.start) {
    return "upcoming";
  }
  if (input.factGapMinutes === null || input.unscheduledGapMinutes === null) {
    return "untracked";
  }
  if (input.factGapMinutes === 0) {
    return "scheduled";
  }
  if (input.deadline && isPastDeadlineDate(input.deadline, input.now, input.timezone)) {
    return "expired";
  }
  if (input.unscheduledGapMinutes === 0) {
    return "scheduled";
  }
  if (
    input.dailyRequiredMinutes !== null &&
    input.recentDailyCapacity > 0 &&
    input.dailyRequiredMinutes > input.recentDailyCapacity
  ) {
    return "imbalanced";
  }
  if (
    input.dailyRequiredMinutes !== null &&
    input.recentDailyCapacity > 0 &&
    input.dailyRequiredMinutes > input.recentDailyCapacity * 0.7
  ) {
    return "tightPace";
  }
  return "needsScheduling";
}

function isPastDeadlineDate(deadline: Date, now: Date, timezone: string): boolean {
  return dayKey(deadline) < localDayKey(now, timezone);
}

function toThreadGroupView(
  group: string,
  items: ThreadView[],
  now: Date,
  timezone: string
): ThreadGroupView {
  const summary = summarizeThreadGroup(items);
  const { commitmentItems } = summary;
  const { start, deadline } = summary;
  const deadlineDate = deadline ? new Date(`${deadline}T00:00:00.000Z`) : null;
  const computedStatus = feasibilityStatus({
    factGapMinutes: summary.factGapMinutes,
    unscheduledGapMinutes: summary.unscheduledGapMinutes,
    dailyRequiredMinutes: summary.dailyRequiredMinutes,
    start,
    deadline: deadlineDate,
    now,
    timezone,
    recentDailyCapacity: 0
  });

  return {
    key: encodeURIComponent(group),
    group,
    expectedMinutes: summary.expectedMinutes,
    start,
    deadline,
    fulfilledMinutes: summary.fulfilledMinutes,
    futureMinutes: summary.futureMinutes,
    externalShiftMinutes: summary.externalShiftMinutes,
    internalShiftMinutes: summary.internalShiftMinutes,
    factGapMinutes: summary.factGapMinutes,
    unscheduledGapMinutes: summary.unscheduledGapMinutes,
    planCoverageRate: summary.planCoverageRate,
    dailyRequiredMinutes: summary.dailyRequiredMinutes,
    status: computedStatus === "fulfilled" && !summary.allItemsInactive ? "untracked" : computedStatus,
    items: [...items].sort((a, b) => statusRank(a.status) - statusRank(b.status))
  };
}

function recentFulfilledDailyCapacity(facts: FactSegment[], now: Date): number {
  const startAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fulfilled = facts
    .filter(
      (fact) =>
        fact.endAt > startAt &&
        fact.startAt <= now &&
        isFulfilledKind(fact.kind)
    )
    .reduce((total, fact) => total + minutesInRange(fact), 0);
  return fulfilled / 30;
}

function laterDayKey(a: string, b: string): string {
  return a > b ? a : b;
}

function activityStateRank(state: ThreadView["activityState"]): number {
  return state === "active" || state === undefined ? 0 : state === "untracked" ? 1 : 2;
}

function compareThreadViews(a: ThreadView, b: ThreadView): number {
  if (a.activityState !== "inactive" && b.activityState !== "inactive") {
    const activeOrder = compareActiveThreadSchedule(a, b);
    if (activeOrder !== 0) {
      return activeOrder;
    }
  }

  return (
    activityStateRank(a.activityState) - activityStateRank(b.activityState) ||
    deadlineRank(a.deadline) - deadlineRank(b.deadline) ||
    startRank(a.start) - startRank(b.start) ||
    statusRank(a.status) - statusRank(b.status)
  );
}

function compareThreadGroupViews(a: ThreadGroupView, b: ThreadGroupView): number {
  return compareActiveThreadSchedule(a, b) || statusRank(a.status) - statusRank(b.status);
}


function latestFactActivityAt(thread: ThreadAccumulator): Date | null {
  return thread.history
    .filter((entry) => entry.source === "fact")
    .map((entry) => entry.endAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function publicThreadKey(group: string, item: string): string {
  return `${encodeURIComponent(group)}/${encodeURIComponent(item)}`;
}
