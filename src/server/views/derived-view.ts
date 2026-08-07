import { parseCalendarEvents } from "@/server/domain/calendar";
import { buildFactLayer, commitmentStats, totalMinutesByKind } from "@/server/domain/facts";
import { maintenanceRate } from "@/server/domain/maintenance";
import { buildThreadGroupViews, buildThreadViews, recentFulfilledDailyCapacity } from "@/server/domain/threads";
import { localDayKey, minutesInRange } from "@/server/domain/time";
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
  internalFulfilledPlanMinutes: number;
  internalFulfillmentRate: number | null;
  fulfillmentRate: number | null;
  maintenanceRate: number;
  recentDailyCapacity: number;
  maintenanceTimeline?: Array<SerializedMaintenanceSegment>;
  factTotals: Record<string, number>;
  protocolErrors: Array<SerializedProtocolError>;
  planTimeline: Array<SerializedPlanSegment>;
  timeline: Array<SerializedFactSegment>;
  threadGroups: ThreadGroupView[];
  threads: ThreadView[];
  threadActivityAttributions: ThreadActivityAttribution[];
  notes: Note[];
}

export interface ThreadActivityAttribution {
  startAt: string;
  endAt: string;
  source: "fact" | "futurePlan";
  kind: string;
  title: string;
  sourceEventId: string | null;
  planEventId: string | null;
  threadGroup: string;
  threadItem: string;
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
  sourceEventId?: string;
  planEventId?: string | null;
}

interface SerializedPlanSegment {
  startAt: string;
  endAt: string;
  kind: string;
  minutes: number;
  title: string;
  group: string;
  item: string;
  sourceEventId?: string;
  planEventId?: string | null;
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
    now: input.now,
    timezone: input.timezone ?? "UTC"
  });
  const threadGroups = buildThreadGroupViews(threads);
  const threadActivityAttributions = threads.flatMap((thread) =>
    thread.history.map((entry) => ({
      startAt: entry.startAt,
      endAt: entry.endAt,
      source: entry.source,
      kind: entry.kind,
      title: entry.title,
      sourceEventId: entry.sourceEventId ?? null,
      planEventId: entry.planEventId ?? null,
      threadGroup: thread.group,
      threadItem: thread.item
    }))
  );
  const recentDailyCapacity = recentFulfilledDailyCapacity(factLayer.facts, input.now);
  const observedSemantics = input.calendarSources.map((source) => source.semantic);

  return {
    private: {
      generatedAt: input.now.toISOString(),
      observedSemantics,
      plannedMinutes: stats.plannedMinutes,
      fulfilledPlanMinutes: stats.fulfilledPlanMinutes,
      internalFulfilledPlanMinutes: stats.internalFulfilledPlanMinutes,
      internalFulfillmentRate: stats.internalFulfillmentRate,
      fulfillmentRate: stats.fulfillmentRate,
      maintenanceRate: maintenanceRate(parsedEvents, input.now, 30, input.timezone ?? "UTC"),
      recentDailyCapacity,
      maintenanceTimeline: parsedEvents.map(serializeMaintenanceSegment),
      factTotals: totalMinutesByKind(factLayer.facts),
      protocolErrors: factLayer.errors.map((error) => serializeError(error, input.timezone ?? "UTC")),
      planTimeline: factLayer.cleanPlanSegments.map(serializePlan),
      timeline: factLayer.facts.map(serializeFact),
      threadGroups,
      threads,
      threadActivityAttributions,
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
    ,sourceEventId: plan.eventId,
    planEventId: plan.eventId
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
    ,sourceEventId: fact.sourceEventId,
    planEventId: fact.coveredPlanEventId ?? fact.sourceEventId
  };
}

function serializeError(error: ProtocolError, timezone: string): SerializedProtocolError {
  return {
    type: error.type,
    date: localDayKey(error.startAt, timezone),
    startAt: error.startAt.toISOString(),
    endAt: error.endAt.toISOString(),
    message: error.message,
    eventIds: error.eventIds
  };
}
