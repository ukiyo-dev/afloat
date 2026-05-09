import { CalDavProvider } from "@/server/calendar/provider";
import { db } from "@/server/db/client";
import { loadCalDavCredential } from "@/server/db/calendar-credentials";
import {
  markMissingRawCalendarEventsDeletedInRange,
  replaceRawCalendarEventsInRange,
  upsertRawCalendarEvents
} from "@/server/db/calendar-events";
import {
  loadKnownCalendarSources,
  loadMappedCalendarSources,
  refreshMappedCalendarSources
} from "@/server/db/calendar-sources";
import { finishSyncRun, startSyncRun } from "@/server/db/sync-runs";
import { addDays } from "@/server/domain/time";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import {
  addYears,
  recalibrationRangesForDirection
} from "@/server/services/recalibration-ranges";
import { type SyncKind, type SyncResult } from "@/server/services/sync-result";
import { recomputeViewsForOwner } from "@/server/services/view-service";

export type { SyncKind, SyncResult } from "@/server/services/sync-result";

const RECALIBRATE_MAX_YEARS = 50;

export interface DiscoveredCalendar {
  id: string;
  name: string;
  mapped: boolean;
  enabled: boolean;
  semantic: string | null;
}

export async function listCalDavCalendars(): Promise<
  | { status: "succeeded"; calendars: DiscoveredCalendar[] }
  | { status: "not_configured"; message: string }
> {
  const ownerId = await getCurrentOwnerId();
  const credential = await loadCalDavCredential(db, ownerId);
  if (!credential) {
    return { status: "not_configured", message: "CalDAV credential is not configured." };
  }

  const provider = new CalDavProvider(credential);
  const calendars = await provider.listCalendars();
  const mapped = await loadKnownCalendarSources(
    db,
    ownerId,
    calendars.map((calendar) => calendar.id)
  );
  const sourceByExternalId = new Map(mapped.map((source) => [source.externalCalendarId, source]));

  return {
    status: "succeeded",
    calendars: calendars.map((calendar) => {
      const source = sourceByExternalId.get(calendar.id);
      return {
        id: calendar.id,
        name: calendar.name,
        mapped: Boolean(source),
        enabled: source?.enabled ?? false,
        semantic: source?.semantic ?? null
      };
    })
  };
}

export async function syncRecent(): Promise<SyncResult> {
  const now = new Date();
  return runCalDavSync("recent", {
    startAt: addDays(now, -30),
    endAt: addDays(now, 30)
  });
}

export async function syncRecalibrate(): Promise<SyncResult> {
  const now = new Date();
  return runCalDavSync(
    "recalibrate",
    {
      startAt: addYears(now, -RECALIBRATE_MAX_YEARS),
      endAt: addYears(now, RECALIBRATE_MAX_YEARS)
    },
    { recalibrateFrom: now }
  );
}

async function runCalDavSync(
  kind: SyncKind,
  range: { startAt: Date; endAt: Date },
  options: { recalibrateFrom?: Date } = {}
): Promise<SyncResult> {
  const ownerId = await getCurrentOwnerId();
  const credential = await loadCalDavCredential(db, ownerId);
  if (!credential) {
    return {
      status: "not_configured",
      kind,
      message: "CalDAV credential is not configured."
    };
  }

  const provider = new CalDavProvider(credential);
  const runId = await startSyncRun(db, ownerId, kind, range);

  try {
    const calendars = await provider.listCalendars();
    await refreshMappedCalendarSources(db, ownerId, credential.id, calendars);

    const mappedSources = await loadMappedCalendarSources(
      db,
      ownerId,
      calendars.map((calendar) => calendar.id)
    );

    if (mappedSources.length === 0) {
      await finishSyncRun(db, runId, "failed", "No enabled CalDAV calendar sources are mapped.");
      return {
        status: "not_configured",
        kind,
        message: "No enabled CalDAV calendar sources are mapped.",
        range: serializeRange(range)
      };
    }

    let eventsFetched = 0;
    let eventsUpserted = 0;
    let eventsMarkedDeleted = 0;
    let eventsRemovedFromCache = 0;

    if (kind === "recalibrate") {
      const result = await recalibrateMappedSources({
        provider,
        ownerId,
        mappedSources,
        now: options.recalibrateFrom ?? new Date(),
        maxYears: RECALIBRATE_MAX_YEARS
      });
      eventsFetched = result.eventsFetched;
      eventsUpserted = result.eventsUpserted;
      eventsRemovedFromCache = result.eventsRemovedFromCache;
    } else {
      for (const source of mappedSources) {
        const events = await provider.listEvents(source.externalCalendarId, range);
        const normalizedEvents = events.map((event) => ({ ...event, calendarSourceId: source.id }));
        eventsFetched += normalizedEvents.length;

        eventsUpserted += await upsertRawCalendarEvents(
          db,
          ownerId,
          "caldav",
          source.externalCalendarId,
          source.id,
          normalizedEvents
        );
        eventsMarkedDeleted += await markMissingRawCalendarEventsDeletedInRange(
          db,
          ownerId,
          "caldav",
          source.externalCalendarId,
          source.id,
          range,
          normalizedEvents
        );
      }
    }

    const views = await recomputeViewsForOwner(ownerId);
    await finishSyncRun(db, runId, "succeeded");

    return {
      status: "succeeded",
      kind,
      message: "CalDAV sync completed.",
      range: serializeRange(range),
      calendars: mappedSources.length,
      eventsFetched,
      eventsUpserted,
      eventsMarkedDeleted,
      eventsRemovedFromCache,
      generatedAt: views.private.generatedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "CalDAV sync failed.";
    await finishSyncRun(db, runId, "failed", message);
    return {
      status: "failed",
      kind,
      message,
      range: serializeRange(range)
    };
  }
}

async function recalibrateMappedSources(input: {
  provider: CalDavProvider;
  ownerId: string;
  mappedSources: Array<{ id: string; externalCalendarId: string }>;
  now: Date;
  maxYears: number;
}): Promise<{
  eventsFetched: number;
  eventsUpserted: number;
  eventsRemovedFromCache: number;
}> {
  let eventsFetched = 0;
  let eventsUpserted = 0;
  let eventsRemovedFromCache = 0;

  for (const direction of [-1, 1] as const) {
    for (const range of recalibrationRangesForDirection(input.now, direction, input.maxYears)) {
      let eventsInRange = 0;

      for (const source of input.mappedSources) {
        const events = await input.provider.listEvents(source.externalCalendarId, range);
        const normalizedEvents = events.map((event) => ({ ...event, calendarSourceId: source.id }));
        const result = await replaceRawCalendarEventsInRange(
          db,
          input.ownerId,
          "caldav",
          source.externalCalendarId,
          source.id,
          range,
          normalizedEvents
        );

        eventsInRange += normalizedEvents.length;
        eventsFetched += normalizedEvents.length;
        eventsUpserted += result.eventsInserted;
        eventsRemovedFromCache += result.eventsRemovedFromCache;
      }

      if (eventsInRange === 0) {
        break;
      }
    }
  }

  return {
    eventsFetched,
    eventsUpserted,
    eventsRemovedFromCache
  };
}

function serializeRange(range: { startAt: Date; endAt: Date }) {
  return {
    startAt: range.startAt.toISOString(),
    endAt: range.endAt.toISOString()
  };
}
