import { and, eq, lt, gt, notInArray, sql } from "drizzle-orm";

import type { RawCalendarEvent } from "@/server/domain/types";

import type { Database } from "./client";
import { calendarEventsRaw } from "./schema";

export async function upsertRawCalendarEvents(
  database: Database,
  ownerId: string,
  provider: string,
  externalCalendarId: string,
  calendarSourceId: string,
  events: RawCalendarEvent[],
  syncedAt = new Date()
): Promise<number> {
  if (events.length === 0) {
    return 0;
  }

  await database
    .insert(calendarEventsRaw)
    .values(
      events.map((event) => ({
        ownerId,
        calendarSourceId,
        provider,
        externalCalendarId,
        externalEventId: event.externalEventId ?? event.id,
        etag: event.etag,
        icalUid: event.icalUid,
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: event.timezone,
        title: event.title,
        rawIcs: event.rawIcs,
        deleted: false,
        syncedAt,
        providerUpdatedAt: event.providerUpdatedAt
      }))
    )
    .onConflictDoUpdate({
      target: [
        calendarEventsRaw.ownerId,
        calendarEventsRaw.provider,
        calendarEventsRaw.externalCalendarId,
        calendarEventsRaw.externalEventId
      ],
      set: {
        calendarSourceId: sql`excluded.calendar_source_id`,
        etag: sql`excluded.etag`,
        icalUid: sql`excluded.ical_uid`,
        startAt: sql`excluded.start_at`,
        endAt: sql`excluded.end_at`,
        timezone: sql`excluded.timezone`,
        title: sql`excluded.title`,
        rawIcs: sql`excluded.raw_ics`,
        deleted: false,
        syncedAt: sql`excluded.synced_at`,
        providerUpdatedAt: sql`excluded.provider_updated_at`
      }
    });

  return events.length;
}

export async function markMissingRawCalendarEventsDeletedInRange(
  database: Database,
  ownerId: string,
  provider: string,
  externalCalendarId: string,
  calendarSourceId: string,
  range: { startAt: Date; endAt: Date },
  events: RawCalendarEvent[],
  syncedAt = new Date()
): Promise<number> {
  const returnedEventIds = events
    .map((event) => event.externalEventId ?? event.id)
    .filter((eventId): eventId is string => Boolean(eventId));
  const predicates = [
    eq(calendarEventsRaw.ownerId, ownerId),
    eq(calendarEventsRaw.provider, provider),
    eq(calendarEventsRaw.externalCalendarId, externalCalendarId),
    eq(calendarEventsRaw.calendarSourceId, calendarSourceId),
    eq(calendarEventsRaw.deleted, false),
    lt(calendarEventsRaw.startAt, range.endAt),
    gt(calendarEventsRaw.endAt, range.startAt)
  ];

  if (returnedEventIds.length > 0) {
    predicates.push(notInArray(calendarEventsRaw.externalEventId, returnedEventIds));
  }

  const marked = await database
    .update(calendarEventsRaw)
    .set({
      deleted: true,
      syncedAt
    })
    .where(and(...predicates))
    .returning({ id: calendarEventsRaw.id });

  return marked.length;
}

export async function replaceRawCalendarEventsInRange(
  database: Database,
  ownerId: string,
  provider: string,
  externalCalendarId: string,
  calendarSourceId: string,
  range: { startAt: Date; endAt: Date },
  events: RawCalendarEvent[],
  syncedAt = new Date()
): Promise<{ eventsInserted: number; eventsRemovedFromCache: number }> {
  const removed = await database
    .delete(calendarEventsRaw)
    .where(
      and(
        eq(calendarEventsRaw.ownerId, ownerId),
        eq(calendarEventsRaw.provider, provider),
        eq(calendarEventsRaw.externalCalendarId, externalCalendarId),
        eq(calendarEventsRaw.calendarSourceId, calendarSourceId),
        lt(calendarEventsRaw.startAt, range.endAt),
        gt(calendarEventsRaw.endAt, range.startAt)
      )
    )
    .returning({ id: calendarEventsRaw.id });

  const eventsInserted = await upsertRawCalendarEvents(
    database,
    ownerId,
    provider,
    externalCalendarId,
    calendarSourceId,
    events,
    syncedAt
  );

  return {
    eventsInserted,
    eventsRemovedFromCache: removed.length
  };
}
