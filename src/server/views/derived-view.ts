import { parseCalendarEvents } from "@/server/domain/calendar";
import { buildFactLayer, commitmentStats, totalMinutesByKind } from "@/server/domain/facts";
import { maintenanceRate } from "@/server/domain/maintenance";
import { buildThreadGroupViews, buildThreadViews } from "@/server/domain/threads";
import { dayKey, minutesInRange } from "@/server/domain/time";
import type {
  CalendarSource,
  FactSegment,
  Note,
  ProtocolError,
  RawCalendarEvent,
  ThreadDeclaration,
  ThreadGroupView,
  ThreadView,
  TimeSegment
} from "@/server/domain/types";

export interface DerivedViewInput {
  calendarSources: CalendarSource[];
  rawEvents: RawCalendarEvent[];
  threadDeclarations: ThreadDeclaration[];
  notes: Note[];
  timezone?: string;
  now: Date;
}

export interface PrivateDerivedView {
  generatedAt: string;
  observedSemantics: string[];
  plannedMinutes: number;
  fulfilledPlanMinutes: number;
  fulfillmentRate: number | null;
  maintenanceRate: number;
  maintenanceTimeline?: Array<SerializedMaintenanceSegment>;
  factTotals: Record<string, number>;
  protocolErrors: Array<SerializedProtocolError>;
  planTimeline: Array<SerializedPlanSegment>;
  timeline: Array<SerializedFactSegment>;
  threadGroups: ThreadGroupView[];
  threads: ThreadView[];
  notes: Note[];
}

export interface DerivedViews {
  private: PrivateDerivedView;
}

interface SerializedFactSegment {
  startAt: string;
  endAt: string;
  kind: string;
  minutes: number;
  title: string;
  group: string;
  item: string;
}

interface SerializedPlanSegment {
  startAt: string;
  endAt: string;
  kind: string;
  minutes: number;
  title: string;
  group: string;
  item: string;
}

interface SerializedMaintenanceSegment {
  startAt: string;
  endAt: string;
  kind: string;
}

interface SerializedProtocolError {
  type: ProtocolError["type"];
  date: string;
  startAt: string;
  endAt: string;
  message: string;
  eventIds: string[];
}

export function buildDerivedViews(input: DerivedViewInput): DerivedViews {
  const parsedEvents = parseCalendarEvents(input.calendarSources, input.rawEvents);
  const factLayer = buildFactLayer(parsedEvents);
  const stats = commitmentStats(factLayer.cleanPlanSegments, factLayer.facts);
  const threads = buildThreadViews({
    declarations: input.threadDeclarations,
    facts: factLayer.facts,
    cleanPlanSegments: factLayer.cleanPlanSegments,
    parsedEvents,
    now: input.now
  });
  const threadGroups = buildThreadGroupViews(threads, input.now);
  const observedSemantics = input.calendarSources.map((source) => source.semantic);

  return {
    private: {
      generatedAt: input.now.toISOString(),
      observedSemantics,
      plannedMinutes: stats.plannedMinutes,
      fulfilledPlanMinutes: stats.fulfilledPlanMinutes,
      fulfillmentRate: stats.fulfillmentRate,
      maintenanceRate: maintenanceRate(parsedEvents, input.now),
      maintenanceTimeline: parsedEvents.map(serializeMaintenanceSegment),
      factTotals: totalMinutesByKind(factLayer.facts),
      protocolErrors: factLayer.errors.map(serializeError),
      planTimeline: factLayer.cleanPlanSegments.map(serializePlan),
      timeline: factLayer.facts.map(serializeFact),
      threadGroups,
      threads,
      notes: [...input.notes].sort((a, b) => b.date.localeCompare(a.date))
    }
  };
}

function serializeMaintenanceSegment(event: { startAt: Date; endAt: Date; kind: string }): SerializedMaintenanceSegment {
  return {
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    kind: event.kind
  };
}

function serializePlan(plan: TimeSegment): SerializedPlanSegment {
  return {
    startAt: plan.startAt.toISOString(),
    endAt: plan.endAt.toISOString(),
    kind: plan.kind,
    minutes: minutesInRange(plan),
    title: plan.title.rawTitle,
    group: plan.title.group,
    item: plan.title.item
  };
}

function serializeFact(fact: FactSegment): SerializedFactSegment {
  return {
    startAt: fact.startAt.toISOString(),
    endAt: fact.endAt.toISOString(),
    kind: fact.kind,
    minutes: minutesInRange(fact),
    title: fact.title.rawTitle,
    group: fact.title.group,
    item: fact.title.item
  };
}

function serializeError(error: ProtocolError): SerializedProtocolError {
  return {
    type: error.type,
    date: dayKey(error.startAt),
    startAt: error.startAt.toISOString(),
    endAt: error.endAt.toISOString(),
    message: error.message,
    eventIds: error.eventIds
  };
}
