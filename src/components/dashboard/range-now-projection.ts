import type { DashboardData } from "@/server/services/dashboard-service";

type RangeView = DashboardData["rangeView"];
type PrivateView = DashboardData["view"];
type TimelineEntry = RangeView["timeline"][number];
type PlanEntry = PrivateView["planTimeline"][number];

const MS_PER_MINUTE = 60_000;

const fulfilledKindByPlanKind: Record<string, string> = {
  ideal: "idealFulfilled",
  leisure: "leisureFulfilled",
  rest: "restFulfilled"
};

export function projectRangeViewForNow({
  rangeView,
  view,
  runtimeNowIso
}: {
  rangeView: RangeView;
  view: PrivateView;
  runtimeNowIso: string;
}): RangeView {
  const baseNow = new Date(view.generatedAt);
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
    existingTimeline: rangeView.timeline,
    baseNow,
    runtimeNow,
    rangeStart,
    rangeEnd
  });

  if (projectedFacts.length === 0) {
    return rangeView;
  }

  const projectedFulfilledPlanMinutes = projectedFacts
    .filter((fact) => isFulfilledKind(fact.kind))
    .reduce((total, fact) => total + fact.minutes, 0);
  const fulfilledPlanMinutes = rangeView.fulfilledPlanMinutes + projectedFulfilledPlanMinutes;
  const internalFulfilledPlanMinutes =
    rangeView.internalFulfilledPlanMinutes + projectedFulfilledPlanMinutes;

  return {
    ...rangeView,
    fulfilledPlanMinutes,
    internalFulfilledPlanMinutes,
    internalFulfillmentRate:
      rangeView.plannedMinutes > 0 ? internalFulfilledPlanMinutes / rangeView.plannedMinutes : null,
    fulfillmentRate:
      rangeView.plannedMinutes > 0 ? fulfilledPlanMinutes / rangeView.plannedMinutes : null,
    factTotals: addFactTotals(rangeView.factTotals, projectedFacts),
    timeline: mergeTimelineEntries([...rangeView.timeline, ...projectedFacts])
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
    const factKind = fulfilledKindByPlanKind[plan.kind];
    if (!factKind) {
      return [];
    }

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
  let remaining = [{ startAt, endAt }];

  for (const entry of existingTimeline) {
    const entryStart = new Date(entry.startAt);
    const entryEnd = new Date(entry.endAt);
    if (!isFiniteDate(entryStart) || !isFiniteDate(entryEnd)) {
      continue;
    }

    remaining = remaining.flatMap((range) => {
      const overlapStart = new Date(Math.max(range.startAt.getTime(), entryStart.getTime()));
      const overlapEnd = new Date(Math.min(range.endAt.getTime(), entryEnd.getTime()));
      if (overlapEnd <= overlapStart) {
        return [range];
      }

      const pieces: Array<{ startAt: Date; endAt: Date }> = [];
      if (range.startAt < overlapStart) {
        pieces.push({ startAt: range.startAt, endAt: overlapStart });
      }
      if (overlapEnd < range.endAt) {
        pieces.push({ startAt: overlapEnd, endAt: range.endAt });
      }
      return pieces;
    });
  }

  return remaining;
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

function mergeTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const sorted = [...entries].sort(
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

function isFulfilledKind(kind: string): boolean {
  return kind === "idealFulfilled" || kind === "leisureFulfilled" || kind === "restFulfilled";
}

function minutesBetween(startAt: Date, endAt: Date): number {
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / MS_PER_MINUTE);
}

function isFiniteDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}
