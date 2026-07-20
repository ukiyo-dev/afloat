import { dayKey, intersection, localDayKey, minutesInRange } from "./time";
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
  fulfilledByClosure: boolean;
  sequences: Set<number>;
  history: Array<{
    startAt: Date;
    endAt: Date;
    kind: string;
    minutes: number;
    title: string;
    source: "fact" | "futurePlan";
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
  const inactiveThreads = new Map<string, ThreadAccumulator>();
  const untrackedThreads = new Map<string, ThreadAccumulator>();
  const untrackedPlanEventIds = new Set<string>();
  const inactiveTailPlanEventIds = new Set<string>();
  const activeKeysByGroup = new Map<string, Set<string>>();
  const timeline = buildThreadTimeline(input.declarations, input.parsedEvents);

  for (const entry of timeline) {
    if (entry.type === "declaration") {
      const declaration = entry.declaration;
      const key = threadKey(declaration.group, declaration.item);
      const thread = ensureThread(activeThreads, declaration.group, declaration.item, "active");
      thread.declared = true;
      thread.declaration = declaration;
      thread.generationStartAt ??= entry.at;
      ensureOpenWindow(thread, entry.at);
      ensureSet(activeKeysByGroup, declaration.group).add(key);
      continue;
    }

    const event = entry.event;
    const key = threadKey(event.title.group, event.title.item);
    if (event.title.sequence === null) {
      const hasExplicitGroupItem = event.title.titleBody.includes("：");
      if (hasExplicitGroupItem && event.title.item === "---") {
        untrackedPlanEventIds.add(event.id);
        continue;
      }
      const thread = activeThreads.get(key);
      const activeKeys = activeKeysByGroup.get(event.title.group);
      if (thread && activeKeys?.has(key)) {
        thread.closed = true;
        if (event.endAt <= input.now) {
          thread.fulfilledByClosure = true;
          closeOpenWindow(thread, event.endAt);
          activeKeys.delete(key);
          activeThreads.delete(key);
          mergeClosedThread(inactiveThreads, thread);
        }
      } else if (event.endAt <= input.now) {
        const inactiveThread = inactiveThreads.get(key);
        if (inactiveThread?.auto && inactiveThread.sequences.size > 0) {
          extendClosedAutoThreadWindow(inactiveThread, event.endAt);
        } else if (hasExplicitGroupItem) {
          untrackedPlanEventIds.add(event.id);
        }
      } else {
        const inactiveThread = inactiveThreads.get(key);
        if (inactiveThread?.auto && inactiveThread.sequences.size > 0) {
          inactiveTailPlanEventIds.add(event.id);
        } else if (hasExplicitGroupItem) {
          untrackedPlanEventIds.add(event.id);
        }
      }
      continue;
    }

    const thread = ensureThread(activeThreads, event.title.group, event.title.item, "active");
    thread.auto = true;
    thread.closed = false;
    thread.fulfilledByClosure = false;
    thread.generationStartAt ??= event.startAt;
    ensureOpenWindow(thread, event.startAt);
    thread.sequences.add(event.title.sequence);
    ensureSet(activeKeysByGroup, event.title.group).add(key);
  }

  const threadAccumulators = [...activeThreads.values(), ...inactiveThreads.values()];
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
          addFactRange(thread, fact, range);
        }
      }
    }
  }

  for (const segment of input.cleanPlanSegments) {
    if (segment.endAt <= input.now) {
      continue;
    }

    const key = threadKey(segment.title.group, segment.title.item);
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
    if (inactiveTailPlanEventIds.has(segment.eventId)) {
      const inactiveThread = inactiveThreads.get(key);
      if (inactiveThread) {
        addElapsedPlanRange(inactiveThread, segment, input.now);
        addFutureRange(inactiveThread, segment, input.now);
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
    addFutureRange(thread, segment, input.now, range.startAt);
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

function addElapsedPlanRange(
  thread: ThreadAccumulator,
  segment: TimeSegment,
  now: Date
): void {
  const range = rangeBeforeNow(segment, now);
  if (!range) {
    return;
  }
  const minutes = minutesInRange(range);
  thread.fulfilledMinutes += minutes;
  thread.history.push({
    ...range,
    kind: fulfilledPlanKind(segment.kind),
    minutes,
    title: segment.title.rawTitle,
    source: "fact"
  });
}

function fulfilledPlanKind(kind: string): string {
  return kind === "ideal"
    ? "idealFulfilled"
    : kind === "leisure"
      ? "leisureFulfilled"
      : kind === "rest"
        ? "restFulfilled"
        : kind;
}

function addFutureRange(
  thread: ThreadAccumulator,
  segment: TimeSegment,
  now: Date,
  effectiveStartAt?: Date
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
    source: "futurePlan"
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
  const key = threadKey(group, item);
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
    fulfilledByClosure: false,
    sequences: new Set(),
    history: []
  };
  threads.set(key, created);
  return created;
}

function addFactRange(
  thread: ThreadAccumulator,
  fact: FactSegment,
  range: { startAt: Date; endAt: Date }
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
    source: "fact"
  });
}

function ensureOpenWindow(thread: ThreadAccumulator, startAt: Date): void {
  if (thread.windows.length === 0) {
    thread.windows.push({ startAt });
  }
}

function closeOpenWindow(thread: ThreadAccumulator, endAt: Date): void {
  const window = thread.windows.at(-1);
  if (window && !window.endAt) {
    window.endAt = endAt;
  }
}

function extendClosedAutoThreadWindow(
  thread: ThreadAccumulator | undefined,
  endAt: Date
): void {
  if (!thread?.auto || thread.sequences.size === 0) {
    return;
  }

  const window = thread.windows.at(-1);
  if (window?.endAt && endAt > window.endAt) {
    window.endAt = endAt;
  }
}

function mergeClosedThread(
  inactiveThreads: Map<string, ThreadAccumulator>,
  closedThread: ThreadAccumulator
): void {
  const inactive = ensureThread(
    inactiveThreads,
    closedThread.group,
    closedThread.item,
    "inactive"
  );
  inactive.declared ||= closedThread.declared;
  inactive.auto ||= closedThread.auto;
  inactive.declaration ??= closedThread.declaration;
  inactive.generationStartAt =
    earlierDate(inactive.generationStartAt, closedThread.generationStartAt) ??
    closedThread.generationStartAt;
  inactive.closed = true;
  inactive.fulfilledByClosure = true;
  for (const sequence of closedThread.sequences) {
    inactive.sequences.add(sequence);
  }
  inactive.windows.push(...closedThread.windows.filter((window) => window.endAt));
}

function buildThreadTimeline(
  declarations: ThreadDeclaration[],
  parsedEvents: ParsedEvent[]
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

  return [...declarationEntries, ...eventEntries].sort(
    (a, b) => a.at.getTime() - b.at.getTime() || timelineEntryRank(a) - timelineEntryRank(b)
  );
}

function timelineEntryRank(entry: ThreadTimelineEntry): number {
  return entry.type === "declaration" ? 0 : 1;
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
      declaredDailyMinutes: null,
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
          source: entry.source
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
    expectedMinutes === null
      ? null
      : thread.fulfilledByClosure
        ? 0
        : Math.max(0, expectedMinutes - thread.fulfilledMinutes);
  const unscheduledGapMinutes =
    expectedMinutes === null
      ? null
      : thread.fulfilledByClosure
        ? 0
        : Math.max(0, expectedMinutes - thread.fulfilledMinutes - thread.futureMinutes);
  const planCoverageRate =
    factGapMinutes === null || factGapMinutes === 0
      ? null
      : thread.futureMinutes / factGapMinutes;
  const today = localDayKey(now, timezone);
  const deadlineKey = deadline ? dayKey(deadline) : null;
  const daysLeft = deadlineKey
    ? inclusiveDaysBetween(laterDayKey(today, start), deadlineKey)
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
    declaredDailyMinutes: thread.declaration?.dailyMinutes ?? null,
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
      fulfilledByClosure: thread.fulfilledByClosure,
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
        source: entry.source
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

function earlierDate(a?: Date, b?: Date): Date | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a <= b ? a : b;
}

function feasibilityStatus(input: {
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  dailyRequiredMinutes: number | null;
  fulfilledByClosure?: boolean;
  start: string | null;
  deadline: Date | null;
  now: Date;
  timezone: string;
  recentDailyCapacity: number;
}): FeasibilityStatus {
  if (input.fulfilledByClosure) {
    return "fulfilled";
  }
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
  const commitmentItems = items.filter((item) => item.activityState !== "untracked");
  const expectedValues = commitmentItems
    .map((item) => item.expectedMinutes)
    .filter((value): value is number => value !== null);
  const expectedMinutes =
    expectedValues.length > 0 ? expectedValues.reduce((total, value) => total + value, 0) : null;
  const deadline = latestDeadline(commitmentItems.map((item) => item.deadline));
  const start = earliestStart(
    commitmentItems.map((item) => item.start).filter((value): value is string => Boolean(value))
  );
  const fulfilledMinutes = sum(items.map((item) => item.fulfilledMinutes));
  const futureMinutes = sum(items.map((item) => item.futureMinutes));
  const externalShiftMinutes = sum(items.map((item) => item.externalShiftMinutes));
  const internalShiftMinutes = sum(items.map((item) => item.internalShiftMinutes));
  const factGapMinutes = sumNullable(commitmentItems.map((item) => item.factGapMinutes));
  const unscheduledGapMinutes = sumNullable(commitmentItems.map((item) => item.unscheduledGapMinutes));
  const coveredFutureMinutes = sum(
    commitmentItems.map((item) =>
      item.factGapMinutes === null ? 0 : Math.min(item.futureMinutes, item.factGapMinutes)
    )
  );
  const planCoverageRate =
    factGapMinutes === null || factGapMinutes === 0 ? null : coveredFutureMinutes / factGapMinutes;
  const deadlineDate = deadline ? new Date(`${deadline}T00:00:00.000Z`) : null;
  const dailyRequiredMinutes = sumNullable(commitmentItems.map((item) => item.dailyRequiredMinutes));
  const allItemsInactive = items.every(
    (item) => item.activityState === "inactive" || item.activityState === "untracked"
  );
  const computedStatus = feasibilityStatus({
    factGapMinutes,
    unscheduledGapMinutes,
    dailyRequiredMinutes,
    fulfilledByClosure:
      commitmentItems.length > 0 && commitmentItems.every((item) => item.status === "fulfilled"),
    start,
    deadline: deadlineDate,
    now,
    timezone,
    recentDailyCapacity: 0
  });

  return {
    key: encodeURIComponent(group),
    group,
    expectedMinutes,
    start,
    deadline,
    fulfilledMinutes,
    futureMinutes,
    externalShiftMinutes,
    internalShiftMinutes,
    factGapMinutes,
    unscheduledGapMinutes,
    planCoverageRate,
    dailyRequiredMinutes,
    status: computedStatus === "fulfilled" && !allItemsInactive ? "untracked" : computedStatus,
    items: [...items].sort((a, b) => statusRank(a.status) - statusRank(b.status))
  };
}

function earliestStart(starts: string[]): string | null {
  return [...starts].sort((a, b) => a.localeCompare(b))[0] ?? null;
}

function latestDeadline(deadlines: Array<string | null>): string | null {
  return deadlines
    .filter((deadline): deadline is string => deadline !== null)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumNullable(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value !== null);
  return numericValues.length > 0 ? sum(numericValues) : null;
}

function recentFulfilledDailyCapacity(facts: FactSegment[], now: Date): number {
  const startAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fulfilled = facts
    .filter(
      (fact) =>
        fact.endAt > startAt &&
        fact.startAt <= now &&
        (fact.kind === "idealFulfilled" ||
          fact.kind === "leisureFulfilled" ||
          fact.kind === "restFulfilled")
    )
    .reduce((total, fact) => total + minutesInRange(fact), 0);
  return fulfilled / 30;
}

function statusRank(status: FeasibilityStatus): number {
  const ranks: Record<FeasibilityStatus, number> = {
    expired: 0,
    stale: 1,
    imbalanced: 2,
    tightPace: 3,
    needsScheduling: 4,
    scheduled: 5,
    fulfilled: 6,
    untracked: 7,
    upcoming: 8
  };
  return ranks[status];
}

function laterDayKey(a: string, b: string): string {
  return a > b ? a : b;
}

function inclusiveDaysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return endMs < startMs ? 0 : Math.round((endMs - startMs) / 86_400_000) + 1;
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

function compareActiveThreadSchedule(
  a: Pick<ThreadView, "start" | "deadline" | "status">,
  b: Pick<ThreadView, "start" | "deadline" | "status">
): number {
  const upcomingOrder = Number(a.status === "upcoming") - Number(b.status === "upcoming");
  if (upcomingOrder !== 0) {
    return upcomingOrder;
  }

  if (a.status === "upcoming" && b.status === "upcoming") {
    return (
      startRank(a.start) - startRank(b.start) ||
      statusRank(a.status) - statusRank(b.status) ||
      deadlineRank(a.deadline) - deadlineRank(b.deadline)
    );
  }

  const deadlinePresenceOrder = Number(a.deadline === null) - Number(b.deadline === null);
  if (deadlinePresenceOrder !== 0) {
    return deadlinePresenceOrder;
  }
  if (a.deadline && b.deadline) {
    return (
      deadlineRank(a.deadline) - deadlineRank(b.deadline) ||
      statusRank(a.status) - statusRank(b.status) ||
      startRank(a.start) - startRank(b.start)
    );
  }
  return (
    startRank(a.start) - startRank(b.start) ||
    statusRank(a.status) - statusRank(b.status)
  );
}

function startRank(start: string | null | undefined): number {
  return start ? Date.parse(`${start}T00:00:00.000Z`) : Number.POSITIVE_INFINITY;
}

function deadlineRank(deadline: string | null): number {
  return deadline ? Date.parse(`${deadline}T00:00:00.000Z`) : Number.POSITIVE_INFINITY;
}

function latestFactActivityAt(thread: ThreadAccumulator): Date | null {
  return thread.history
    .filter((entry) => entry.source === "fact")
    .map((entry) => entry.endAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function threadKey(group: string, item: string): string {
  return `${group}\u0000${item}`;
}

function publicThreadKey(group: string, item: string): string {
  return `${encodeURIComponent(group)}/${encodeURIComponent(item)}`;
}
