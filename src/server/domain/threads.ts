import { daysBetween, minutesInRange } from "./time";
import type {
  FactSegment,
  FeasibilityStatus,
  ParsedEvent,
  ThreadDeclaration,
  ThreadGroupView,
  ThreadSource,
  ThreadView,
  TimeSegment
} from "./types";

interface ThreadAccumulator {
  group: string;
  item: string;
  declared: boolean;
  auto: boolean;
  declaration?: ThreadDeclaration;
  generationStartAt?: Date;
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
}): ThreadView[] {
  const threads = new Map<string, ThreadAccumulator>();
  const activeKeysByGroup = new Map<string, Set<string>>();
  const historicallyClosedKeysByGroup = new Map<string, Set<string>>();
  const timeline = buildThreadTimeline(input.declarations, input.parsedEvents);

  for (const entry of timeline) {
    if (entry.type === "declaration") {
      const declaration = entry.declaration;
      const key = threadKey(declaration.group, declaration.item);
      const thread = ensureThread(threads, declaration.group, declaration.item);
      thread.declared = true;
      thread.declaration = declaration;
      thread.generationStartAt ??= entry.at;
      ensureSet(activeKeysByGroup, declaration.group).add(key);
      historicallyClosedKeysByGroup.get(declaration.group)?.delete(key);
      continue;
    }

    const event = entry.event;
    const key = threadKey(event.title.group, event.title.item);
    if (event.title.sequence === null) {
      const thread = threads.get(key);
      const activeKeys = activeKeysByGroup.get(event.title.group);
      if (thread && activeKeys?.has(key)) {
        thread.closed = true;
        if (event.endAt <= input.now) {
          thread.fulfilledByClosure = true;
          const closedKeys = ensureSet(historicallyClosedKeysByGroup, event.title.group);
          closedKeys.add(key);
          releaseClosedGroup({
            threads,
            activeKeys,
            closedKeys
          });
        }
      }
      continue;
    }

    const thread = ensureThread(threads, event.title.group, event.title.item);
    thread.auto = true;
    thread.closed = false;
    thread.fulfilledByClosure = false;
    thread.generationStartAt ??= event.startAt;
    thread.sequences.add(event.title.sequence);
    ensureSet(activeKeysByGroup, event.title.group).add(key);
    historicallyClosedKeysByGroup.get(event.title.group)?.delete(key);
  }

  for (const fact of input.facts) {
    if (fact.startAt >= input.now) {
      continue;
    }

    const thread = threads.get(threadKey(fact.title.group, fact.title.item));
    if (!thread) {
      continue;
    }
    if (thread.generationStartAt && fact.endAt <= thread.generationStartAt) {
      continue;
    }

    const minutes = minutesInRange({
      startAt:
        thread.generationStartAt && fact.startAt < thread.generationStartAt
          ? thread.generationStartAt
          : fact.startAt,
      endAt: fact.endAt > input.now ? input.now : fact.endAt
    });
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
      startAt:
        thread.generationStartAt && fact.startAt < thread.generationStartAt
          ? thread.generationStartAt
          : fact.startAt,
      endAt: fact.endAt > input.now ? input.now : fact.endAt,
      kind: fact.kind,
      minutes,
      title: fact.title.rawTitle,
      source: "fact"
    });
  }

  for (const segment of input.cleanPlanSegments) {
    if (segment.endAt <= input.now) {
      continue;
    }

    const thread = threads.get(threadKey(segment.title.group, segment.title.item));
    if (!thread) {
      continue;
    }
    if (thread.generationStartAt && segment.endAt <= thread.generationStartAt) {
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

  const recentDailyCapacity = recentFulfilledDailyCapacity(input.facts, input.now);

  return [...threads.values()]
    .map((thread) => toThreadView(thread, input.now, recentDailyCapacity))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));
}

export function buildThreadGroupViews(threads: ThreadView[], now: Date): ThreadGroupView[] {
  const byGroup = new Map<string, ThreadView[]>();
  for (const thread of threads) {
    byGroup.set(thread.group, [...(byGroup.get(thread.group) ?? []), thread]);
  }

  return [...byGroup.entries()]
    .map(([group, items]) => toThreadGroupView(group, items, now))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));
}

function ensureThread(
  threads: Map<string, ThreadAccumulator>,
  group: string,
  item: string
): ThreadAccumulator {
  const key = threadKey(group, item);
  const existing = threads.get(key);
  if (existing) {
    return existing;
  }

  const created: ThreadAccumulator = {
    group,
    item,
    declared: false,
    auto: false,
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

function releaseClosedGroup(input: {
  threads: Map<string, ThreadAccumulator>;
  activeKeys: Set<string>;
  closedKeys: Set<string>;
}): void {
  if (input.activeKeys.size === 0) {
    return;
  }
  for (const key of input.activeKeys) {
    if (!input.closedKeys.has(key)) {
      return;
    }
  }
  for (const key of input.activeKeys) {
    input.threads.delete(key);
  }
  input.activeKeys.clear();
  input.closedKeys.clear();
}

function toThreadView(
  thread: ThreadAccumulator,
  now: Date,
  recentDailyCapacity: number
): ThreadView {
  const source: ThreadSource =
    thread.declared && thread.auto ? "both" : thread.declared ? "declared" : "auto";
  const expectedMinutes = thread.declaration?.expectedMinutes ?? null;
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
  const daysLeft = deadline ? daysBetween(now, deadline) : null;
  const dailyRequiredMinutes =
    unscheduledGapMinutes !== null && deadline && daysLeft !== null && daysLeft > 0
      ? unscheduledGapMinutes / daysLeft
      : null;

  return {
    key: publicThreadKey(thread.group, thread.item),
    group: thread.group,
    item: thread.item,
    source,
    fulfilledMinutes: thread.fulfilledMinutes,
    futureMinutes: thread.futureMinutes,
    externalShiftMinutes: thread.externalShiftMinutes,
    internalShiftMinutes: thread.internalShiftMinutes,
    expectedMinutes,
    deadline: deadline ? deadline.toISOString().slice(0, 10) : null,
    factGapMinutes,
    unscheduledGapMinutes,
    planCoverageRate,
    dailyRequiredMinutes,
    status: feasibilityStatus({
      factGapMinutes,
      unscheduledGapMinutes,
      dailyRequiredMinutes,
      fulfilledByClosure: thread.fulfilledByClosure,
      deadline,
      now,
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

function feasibilityStatus(input: {
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  dailyRequiredMinutes: number | null;
  fulfilledByClosure?: boolean;
  deadline: Date | null;
  now: Date;
  recentDailyCapacity: number;
}): FeasibilityStatus {
  if (input.fulfilledByClosure) {
    return "fulfilled";
  }
  if (input.factGapMinutes === null || input.unscheduledGapMinutes === null) {
    return "untracked";
  }
  if (input.factGapMinutes === 0) {
    return "scheduled";
  }
  if (input.deadline && input.deadline < input.now) {
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

function toThreadGroupView(group: string, items: ThreadView[], now: Date): ThreadGroupView {
  const expectedValues = items
    .map((item) => item.expectedMinutes)
    .filter((value): value is number => value !== null);
  const expectedMinutes =
    expectedValues.length > 0 ? expectedValues.reduce((total, value) => total + value, 0) : null;
  const deadline = latestDeadline(items.map((item) => item.deadline));
  const fulfilledMinutes = sum(items.map((item) => item.fulfilledMinutes));
  const futureMinutes = sum(items.map((item) => item.futureMinutes));
  const externalShiftMinutes = sum(items.map((item) => item.externalShiftMinutes));
  const internalShiftMinutes = sum(items.map((item) => item.internalShiftMinutes));
  const factGapMinutes = sumNullable(items.map((item) => item.factGapMinutes));
  const unscheduledGapMinutes = sumNullable(items.map((item) => item.unscheduledGapMinutes));
  const coveredFutureMinutes = sum(
    items.map((item) =>
      item.factGapMinutes === null ? 0 : Math.min(item.futureMinutes, item.factGapMinutes)
    )
  );
  const planCoverageRate =
    factGapMinutes === null || factGapMinutes === 0 ? null : coveredFutureMinutes / factGapMinutes;
  const deadlineDate = deadline ? new Date(`${deadline}T00:00:00.000Z`) : null;
  const dailyRequiredMinutes = sumNullable(items.map((item) => item.dailyRequiredMinutes));

  return {
    key: encodeURIComponent(group),
    group,
    expectedMinutes,
    deadline,
    fulfilledMinutes,
    futureMinutes,
    externalShiftMinutes,
    internalShiftMinutes,
    factGapMinutes,
    unscheduledGapMinutes,
    planCoverageRate,
    dailyRequiredMinutes,
    status: feasibilityStatus({
      factGapMinutes,
      unscheduledGapMinutes,
      dailyRequiredMinutes,
      fulfilledByClosure: items.every((item) => item.status === "fulfilled"),
      deadline: deadlineDate,
      now,
      recentDailyCapacity: 0
    }),
    items: [...items].sort((a, b) => statusRank(a.status) - statusRank(b.status))
  };
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
    imbalanced: 1,
    tightPace: 2,
    needsScheduling: 3,
    scheduled: 4,
    fulfilled: 5,
    untracked: 6
  };
  return ranks[status];
}

function threadKey(group: string, item: string): string {
  return `${group}\u0000${item}`;
}

function publicThreadKey(group: string, item: string): string {
  return `${encodeURIComponent(group)}/${encodeURIComponent(item)}`;
}
