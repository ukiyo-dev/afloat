import { isFulfilledKind } from "./semantic-kinds";
import { intersection, minutesInRange } from "./time";
import type { DateRange } from "./types";

export interface TimedSegment {
  startAt: Date | string;
  endAt: Date | string;
}

export interface KindSegment extends TimedSegment {
  kind: string;
}

export interface CommitmentStatsOptions {
  planRange?: DateRange | null;
  observedRange?: DateRange | null;
}

export interface CommitmentStats {
  plannedMinutes: number;
  fulfilledPlanMinutes: number;
  fulfillmentRate: number | null;
  internalFulfilledPlanMinutes: number;
  internalFulfillmentRate: number | null;
}

export function commitmentStats(
  planSegments: TimedSegment[],
  facts: KindSegment[],
  options: CommitmentStatsOptions = {}
): CommitmentStats {
  const plannedMinutes = sumMinutes(planSegments, options.planRange);
  const fulfilledPlanMinutes = sumMinutes(
    facts.filter((fact) => isFulfilledKind(fact.kind)),
    options.observedRange
  );
  const externalShiftPlanMinutes = overlapMinutes(
    planSegments,
    facts.filter((fact) => fact.kind === "externalShift"),
    options.planRange,
    options.observedRange
  );
  const internalFulfilledPlanMinutes = fulfilledPlanMinutes + externalShiftPlanMinutes;

  return {
    plannedMinutes,
    fulfilledPlanMinutes,
    fulfillmentRate: plannedMinutes > 0 ? fulfilledPlanMinutes / plannedMinutes : null,
    internalFulfilledPlanMinutes,
    internalFulfillmentRate:
      plannedMinutes > 0 ? internalFulfilledPlanMinutes / plannedMinutes : null
  };
}

export function sumMinutes(segments: TimedSegment[], range?: DateRange | null): number {
  return segments.reduce((total, segment) => total + clippedMinutes(segment, range), 0);
}

export function totalMinutesByKind(
  segments: KindSegment[],
  range?: DateRange | null
): Record<string, number> {
  if (range === null) {
    return {};
  }

  return segments.reduce<Record<string, number>>((totals, segment) => {
    totals[segment.kind] = (totals[segment.kind] ?? 0) + clippedMinutes(segment, range);
    return totals;
  }, {});
}

export function clippedMinutes(
  segment: TimedSegment,
  range?: DateRange | null
): number {
  const clipped = clippedRange(segment, range);
  return clipped ? minutesInRange(clipped) : 0;
}

function overlapMinutes(
  plans: TimedSegment[],
  shifts: TimedSegment[],
  planRange?: DateRange | null,
  observedRange?: DateRange | null
): number {
  return shifts.reduce((total, shift) => {
    const shiftRange = clippedRange(shift, observedRange);
    if (!shiftRange) {
      return total;
    }

    return total + plans.reduce((shiftTotal, plan) => {
      const planRangeValue = clippedRange(plan, planRange);
      if (!planRangeValue) {
        return shiftTotal;
      }

      const overlap = intersection(planRangeValue, shiftRange);
      return shiftTotal + (overlap ? minutesInRange(overlap) : 0);
    }, 0);
  }, 0);
}

function clippedRange(
  segment: TimedSegment,
  range?: DateRange | null
): DateRange | null {
  const segmentRange = toDateRange(segment);
  if (!segmentRange || range === null) {
    return null;
  }

  return range === undefined ? segmentRange : intersection(segmentRange, range);
}

function toDateRange(segment: TimedSegment): DateRange | null {
  const startAt = toDate(segment.startAt);
  const endAt = toDate(segment.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) {
    return null;
  }

  return { startAt, endAt };
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}
