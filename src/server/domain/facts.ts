import {
  intersection,
  overlaps,
  subtractRanges
} from "./time";
import { fulfilledKindByPlanKind } from "./semantic-kinds";
import { threadIdentityKey } from "./thread-summary";
import type {
  FactSegment,
  ParsedEvent,
  PlanKind,
  ProtocolError,
  SemanticKind,
  TimeSegment
} from "./types";

export { commitmentStats, totalMinutesByKind } from "./commitment-stats";

export function detectLayerOverlaps(events: ParsedEvent[]): ProtocolError[] {
  const errors: ProtocolError[] = [];
  const byLayer = {
    plan: events.filter((event) => event.layer === "plan"),
    shift: events.filter((event) => event.layer === "shift")
  };

  for (const [layer, layerEvents] of Object.entries(byLayer)) {
    const sorted = [...layerEvents].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime()
    );

    for (let index = 0; index < sorted.length; index += 1) {
      for (let next = index + 1; next < sorted.length; next += 1) {
        if (sorted[next]!.startAt >= sorted[index]!.endAt) {
          break;
        }

        const range = intersection(sorted[index]!, sorted[next]!);
        if (!range) {
          continue;
        }

        errors.push({
          type: layer === "plan" ? "planOverlap" : "shiftOverlap",
          startAt: range.startAt,
          endAt: range.endAt,
          eventIds: [sorted[index]!.id, sorted[next]!.id],
          message: layer === "plan" ? "计划层重叠" : "偏移层重叠"
        });
      }
    }
  }

  return errors;
}

export function detectSequenceRegressions(events: ParsedEvent[]): ProtocolError[] {
  const errors: ProtocolError[] = [];
  const planEvents = events
    .filter((event) => event.layer === "plan")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const lastByThread = new Map<string, ParsedEvent>();

  for (const event of planEvents) {
    const key = threadIdentityKey(event.title.group, event.title.item);
    if (event.title.threadStart) {
      lastByThread.delete(key);
    }

    if (event.title.sequence === null) continue;

    const previous = lastByThread.get(key);
    if (
      previous &&
      previous.title.sequence !== null &&
      event.title.sequence < previous.title.sequence
    ) {
      errors.push({
        type: "sequenceRegression",
        startAt: event.startAt,
        endAt: event.endAt,
        eventIds: [previous.id, event.id],
        message: "线程序号倒退"
      });
    }
    lastByThread.set(key, event);
  }

  return errors;
}

export function buildFactLayer(events: ParsedEvent[]): {
  facts: FactSegment[];
  errors: ProtocolError[];
  cleanPlanSegments: TimeSegment[];
  cleanShiftSegments: TimeSegment[];
} {
  const overlapErrors = detectLayerOverlaps(events);
  const sequenceErrors = detectSequenceRegressions(events);
  const planErrorRanges = overlapErrors.filter((error) => error.type === "planOverlap");
  const shiftErrorRanges = overlapErrors.filter((error) => error.type === "shiftOverlap");

  const cleanPlanSegments = cleanSegments(
    events.filter((event) => event.layer === "plan"),
    planErrorRanges
  );
  const cleanShiftSegments = cleanSegments(
    events.filter((event) => event.layer === "shift"),
    shiftErrorRanges
  );

  const planFacts = cleanPlanSegments.flatMap((segment) => {
    const blockers = cleanShiftSegments.filter((shift) => overlaps(segment, shift));
    return subtractRanges(segment, blockers).map((range) => ({
      ...range,
      kind: fulfilledKindByPlanKind[segment.kind as PlanKind],
      sourceEventId: segment.eventId,
      title: segment.title
    }));
  });

  const shiftFacts = cleanShiftSegments.map((segment) => {
    const coveredPlan = cleanPlanSegments.find((plan) => overlaps(plan, segment));
    return {
      startAt: segment.startAt,
      endAt: segment.endAt,
      kind: segment.kind as "externalShift" | "internalShift",
      sourceEventId: segment.eventId,
      title: segment.title,
      coveredPlanEventId: coveredPlan?.eventId
    };
  });

  return {
    facts: [...planFacts, ...shiftFacts].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime()
    ),
    errors: [...overlapErrors, ...sequenceErrors],
    cleanPlanSegments,
    cleanShiftSegments
  };
}

function cleanSegments(events: ParsedEvent[], blockers: ProtocolError[]): TimeSegment[] {
  return events.flatMap((event) =>
    subtractRanges(event, blockers).map((range) => ({
      ...range,
      eventId: event.id,
      kind: event.kind as SemanticKind,
      title: event.title
    }))
  );
}
