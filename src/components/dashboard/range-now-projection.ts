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

    const clippedStart = new Date(Math.max(startAt.getTime(), rangeStart.getTime()));
    const clippedEnd = new Date(Math.min(endAt.getTime(), observedEnd.getTime()));
    return total + minutesBetween(clippedStart, clippedEnd);
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
    const startAt = new Date(entry.startAt);
    const endAt = new Date(entry.endAt);
    if (!isFiniteDate(startAt) || !isFiniteDate(endAt)) {
      return [];
    }

    const clippedStart = new Date(Math.max(startAt.getTime(), rangeStart.getTime()));
    const clippedEnd = new Date(Math.min(endAt.getTime(), rangeEnd.getTime()));
    if (clippedEnd <= clippedStart) {
      return [];
    }

    return [{
      ...entry,
      startAt: clippedStart.toISOString(),
      endAt: clippedEnd.toISOString(),
      minutes: minutesBetween(clippedStart, clippedEnd)
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

function isFulfilledKind(kind: string): boolean {
  return kind === "idealFulfilled" || kind === "leisureFulfilled" || kind === "restFulfilled";
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
      plans.some((plan) => overlaps(plan, observedDayStart, observedDayEnd))
    ) {
      count += 1;
    }

    cursor = next;
  }

  return count;
}

function overlaps(segment: { startAt: string; endAt: string }, startAt: Date, endAt: Date): boolean {
  const segmentStart = new Date(segment.startAt);
  const segmentEnd = new Date(segment.endAt);
  return isFiniteDate(segmentStart) && isFiniteDate(segmentEnd) && segmentStart < endAt && segmentEnd > startAt;
}

function localDateFromKey(value: string): LocalDate {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function localMidnightToUtc(date: LocalDate, timezone: string): Date {
  const localAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  let guess = new Date(localAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const offset = timezoneOffsetMs(guess, timezone);
    guess = new Date(localAsUtc - offset);
  }

  return guess;
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const zonedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );

  return zonedAsUtc - date.getTime();
}

function formatLocalDate(date: LocalDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function minutesBetween(startAt: Date, endAt: Date): number {
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / MS_PER_MINUTE);
}

function isFiniteDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}
