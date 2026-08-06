import type { DashboardData } from "@/server/services/dashboard-service";
import {
  addLocalDays,
  formatLocalDate,
  intersection,
  localDateFromKey,
  localMidnightToUtc,
  minutesBetween,
  overlaps,
  subtractRanges
} from "@/server/domain/time";
import type { DateRange } from "@/server/domain/types";
import {
  fulfilledKindByPlanKind,
  isFulfilledKind,
  isPlanKind
} from "@/server/domain/semantic-kinds";

type RangeView = DashboardData["rangeView"];
type PrivateView = DashboardData["view"];
type TimelineEntry = RangeView["timeline"][number];
type PlanEntry = PrivateView["planTimeline"][number];

const MS_PER_MINUTE = 60_000;

export function projectRangeViewForNow({
  rangeView,
  view,
  runtimeNowIso
}: {
  rangeView: RangeView;
  view: PrivateView;
  runtimeNowIso: string;
}): RangeView {
  const baseNow = new Date(rangeView.runtimeNow ?? view.generatedAt);
  const runtimeNow = new Date(runtimeNowIso);
  const rangeStart = new Date(rangeView.startAt);
  const rangeEnd = new Date(rangeView.endAt);

  if (
    !isFiniteDate(baseNow) ||
    !isFiniteDate(runtimeNow) ||
    !isFiniteDate(rangeStart) ||
    !isFiniteDate(rangeEnd) ||
    runtimeNow <= baseNow ||
    rangeEnd <= rangeStart
  ) {
    return rangeView;
  }

  const projectedFacts = buildProjectedFacts({
    plans: view.planTimeline ?? [],
    existingTimeline: clipTimelineToRange(rangeView.timeline, rangeStart, baseNow),
    baseNow,
    runtimeNow,
    rangeStart,
    rangeEnd
  });

  if (projectedFacts.length === 0) {
    return rangeView;
  }

  const observedPlannedMinutes = Math.max(
    rangeView.observedPlannedMinutes,
    calculateObservedPlannedMinutes({
      plans: view.planTimeline ?? [],
      rangeStart,
      rangeEnd,
      runtimeNow
    })
  );
  const remainingFulfilledMinutes = Math.max(
    0,
    observedPlannedMinutes - rangeView.fulfilledPlanMinutes
  );
  const effectiveProjectedFacts = takeProjectedMinutes(projectedFacts, remainingFulfilledMinutes);
  const projectedFulfilledPlanMinutes = effectiveProjectedFacts
    .filter((fact) => isFulfilledKind(fact.kind))
    .reduce((total, fact) => total + fact.minutes, 0);
  const fulfilledPlanMinutes = rangeView.fulfilledPlanMinutes + projectedFulfilledPlanMinutes;
  const internalFulfilledPlanMinutes =
    rangeView.internalFulfilledPlanMinutes + projectedFulfilledPlanMinutes;
  const observedPlannedDays = countObservedPlannedDays({
    plans: view.planTimeline ?? [],
    rangeStart,
    rangeEnd,
    runtimeNow,
    startDate: rangeView.startDate,
    endDate: rangeView.endDate,
    timezone: rangeView.timezone
  });

  return {
    ...rangeView,
    observedPlannedMinutes,
    observedPlannedDays,
    fulfilledPlanMinutes,
    internalFulfilledPlanMinutes,
    internalFulfillmentRate:
      observedPlannedMinutes > 0 ? internalFulfilledPlanMinutes / observedPlannedMinutes : null,
    fulfillmentRate:
      observedPlannedMinutes > 0 ? fulfilledPlanMinutes / observedPlannedMinutes : null,
    factTotals: addFactTotals(rangeView.factTotals, effectiveProjectedFacts),
    timeline: mergeTimelineEntries([...rangeView.timeline, ...effectiveProjectedFacts])
  };
}

function buildProjectedFacts({
  plans,
  existingTimeline,
  baseNow,
  runtimeNow,
  rangeStart,
  rangeEnd
}: {
  plans: PlanEntry[];
  existingTimeline: TimelineEntry[];
  baseNow: Date;
  runtimeNow: Date;
  rangeStart: Date;
  rangeEnd: Date;
}): TimelineEntry[] {
  return plans.flatMap((plan) => {
    if (!isPlanKind(plan.kind)) {
      return [];
    }
    const factKind = fulfilledKindByPlanKind[plan.kind];

    const planStart = new Date(plan.startAt);
    const planEnd = new Date(plan.endAt);
    if (!isFiniteDate(planStart) || !isFiniteDate(planEnd)) {
      return [];
    }

    const startAt = new Date(
      Math.max(planStart.getTime(), baseNow.getTime(), rangeStart.getTime())
    );
    const endAt = new Date(
      Math.min(planEnd.getTime(), runtimeNow.getTime(), rangeEnd.getTime())
    );
    if (endAt <= startAt) {
      return [];
    }

    return subtractExistingTimeline({
      startAt,
      endAt,
      existingTimeline: existingTimeline.filter(
        (entry) =>
          entry.kind === factKind &&
          entry.title === plan.title &&
          entry.group === plan.group &&
          entry.item === plan.item
      )
    }).map((range) => ({
      startAt: range.startAt.toISOString(),
      endAt: range.endAt.toISOString(),
      kind: factKind,
      minutes: minutesBetween(range.startAt, range.endAt),
      title: plan.title,
      group: plan.group,
      item: plan.item
    }));
  });
}

function subtractExistingTimeline({
  startAt,
  endAt,
  existingTimeline
}: {
  startAt: Date;
  endAt: Date;
  existingTimeline: TimelineEntry[];
}): Array<{ startAt: Date; endAt: Date }> {
  const blockers = existingTimeline.flatMap((entry) => {
    const range = serializedRange(entry);
    return range ? [range] : [];
  });
  return subtractRanges({ startAt, endAt }, blockers);
}

function addFactTotals(
  factTotals: Record<string, number>,
  projectedFacts: TimelineEntry[]
): Record<string, number> {
  const next = { ...factTotals };
  for (const fact of projectedFacts) {
    next[fact.kind] = (next[fact.kind] ?? 0) + fact.minutes;
  }
  return next;
}

function takeProjectedMinutes(projectedFacts: TimelineEntry[], maxMinutes: number): TimelineEntry[] {
  if (maxMinutes <= 0) {
    return [];
  }

  let remaining = maxMinutes;
  const facts: TimelineEntry[] = [];

  for (const fact of projectedFacts) {
    if (remaining <= 0) {
      break;
    }

    const minutes = Math.min(fact.minutes, remaining);
    remaining -= minutes;
    if (minutes === fact.minutes) {
      facts.push(fact);
      continue;
    }

    const startAt = new Date(fact.startAt);
    if (!isFiniteDate(startAt)) {
      continue;
    }
    const endAt = new Date(startAt.getTime() + minutes * MS_PER_MINUTE);
    facts.push({
      ...fact,
      endAt: endAt.toISOString(),
      minutes
    });
  }

  return facts;
}

function calculateObservedPlannedMinutes({
  plans,
  rangeStart,
  rangeEnd,
  runtimeNow
}: {
  plans: PlanEntry[];
  rangeStart: Date;
  rangeEnd: Date;
  runtimeNow: Date;
}): number {
  const observedEnd = new Date(Math.min(runtimeNow.getTime(), rangeEnd.getTime()));
  if (observedEnd <= rangeStart) {
    return 0;
  }

  return plans.reduce((total, plan) => {
    const startAt = new Date(plan.startAt);
    const endAt = new Date(plan.endAt);
    if (!isFiniteDate(startAt) || !isFiniteDate(endAt)) {
      return total;
    }

    const clipped = intersection(
      { startAt, endAt },
      { startAt: rangeStart, endAt: observedEnd }
    );
    return total + (clipped ? minutesBetween(clipped.startAt, clipped.endAt) : 0);
  }, 0);
}

function clipTimelineToRange(
  timeline: TimelineEntry[],
  rangeStart: Date,
  rangeEnd: Date
): TimelineEntry[] {
  if (rangeEnd <= rangeStart) {
    return [];
  }

  return timeline.flatMap((entry) => {
    const entryRange = serializedRange(entry);
    if (!entryRange) {
      return [];
    }

    const clipped = intersection(entryRange, { startAt: rangeStart, endAt: rangeEnd });
    if (!clipped) {
      return [];
    }

    return [{
      ...entry,
      startAt: clipped.startAt.toISOString(),
      endAt: clipped.endAt.toISOString(),
      minutes: minutesBetween(clipped.startAt, clipped.endAt)
    }];
  });
}

function mergeTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  // The projection is recomputed every minute. Clone each entry before merging so
  // extending a projected segment never mutates the server snapshot passed in
  // through rangeView.timeline.
  const sorted = entries.map((entry) => ({ ...entry })).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  const merged: TimelineEntry[] = [];

  for (const entry of sorted) {
    const previous = merged.at(-1);
    if (!previous || !canMergeTimelineEntries(previous, entry)) {
      merged.push(entry);
      continue;
    }

    previous.endAt =
      new Date(entry.endAt).getTime() > new Date(previous.endAt).getTime()
        ? entry.endAt
        : previous.endAt;
    previous.minutes += entry.minutes;
  }

  return merged.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function canMergeTimelineEntries(a: TimelineEntry, b: TimelineEntry): boolean {
  if (a.kind !== b.kind || a.title !== b.title || a.group !== b.group || a.item !== b.item) {
    return false;
  }

  const aEndMs = new Date(a.endAt).getTime();
  const bStartMs = new Date(b.startAt).getTime();
  return Number.isFinite(aEndMs) && Number.isFinite(bStartMs) && aEndMs >= bStartMs;
}

function countObservedPlannedDays({
  plans,
  rangeStart,
  rangeEnd,
  runtimeNow,
  startDate,
  endDate,
  timezone
}: {
  plans: PlanEntry[];
  rangeStart: Date;
  rangeEnd: Date;
  runtimeNow: Date;
  startDate: string;
  endDate: string;
  timezone: string;
}): number {
  const observedEnd = new Date(Math.min(runtimeNow.getTime(), rangeEnd.getTime()));
  if (observedEnd <= rangeStart) {
    return 0;
  }

  let count = 0;
  let cursor = localDateFromKey(startDate);
  const end = endDate;

  while (formatLocalDate(cursor) <= end) {
    const next = addLocalDays(cursor, 1);
    const dayStart = localMidnightToUtc(cursor, timezone);
    const dayEnd = localMidnightToUtc(next, timezone);
    const observedDayStart = new Date(Math.max(dayStart.getTime(), rangeStart.getTime()));
    const observedDayEnd = new Date(Math.min(dayEnd.getTime(), observedEnd.getTime()));

    if (
      observedDayEnd > observedDayStart &&
      plans.some((plan) => {
        const planRange = serializedRange(plan);
        return planRange
          ? overlaps(planRange, { startAt: observedDayStart, endAt: observedDayEnd })
          : false;
      })
    ) {
      count += 1;
    }

    cursor = next;
  }

  return count;
}

function serializedRange(segment: { startAt: string; endAt: string }): DateRange | null {
  const startAt = new Date(segment.startAt);
  const endAt = new Date(segment.endAt);
  return isFiniteDate(startAt) && isFiniteDate(endAt) ? { startAt, endAt } : null;
}

function isFiniteDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}
