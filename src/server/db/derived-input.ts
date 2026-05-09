import { and, eq } from "drizzle-orm";

import type { CalendarSource, Note, RawCalendarEvent, ThreadDeclaration } from "@/server/domain/types";
import type { DerivedViewInput } from "@/server/views/derived-view";

import type { Database } from "./client";
import { calendarEventsRaw, calendarSources, notes, settings, threadDeclarations } from "./schema";

export async function loadDerivedViewInput(
  database: Database,
  ownerId: string,
  now = new Date()
): Promise<DerivedViewInput> {
  const [sourceRows, eventRows, declarationRows, noteRows, settingsRow] = await Promise.all([
    database
      .select()
      .from(calendarSources)
      .where(and(eq(calendarSources.ownerId, ownerId), eq(calendarSources.enabled, true))),
    database
      .select()
      .from(calendarEventsRaw)
      .where(and(eq(calendarEventsRaw.ownerId, ownerId), eq(calendarEventsRaw.deleted, false))),
    database
      .select()
      .from(threadDeclarations)
      .where(eq(threadDeclarations.ownerId, ownerId)),
    database.select().from(notes).where(eq(notes.ownerId, ownerId)),
    database.query.settings.findFirst({ where: eq(settings.ownerId, ownerId) })
  ]);

  return {
    calendarSources: sourceRows.map(
      (source): CalendarSource => ({
        id: source.id,
        name: source.name,
        semantic: source.semantic,
        provider: source.provider,
        externalCalendarId: source.externalCalendarId
      })
    ),
    rawEvents: eventRows.map(
      (event): RawCalendarEvent => ({
        id: event.id,
        calendarSourceId: event.calendarSourceId,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: event.timezone,
        externalEventId: event.externalEventId,
        rawIcs: event.rawIcs
      })
    ),
    threadDeclarations: declarationRows.map(
      (thread): ThreadDeclaration => ({
        id: thread.id,
        group: thread.group,
        item: thread.item,
        expectedMinutes: thread.expectedMinutes,
        deadline: thread.deadline,
        createdAt: thread.createdAt
      })
    ),
    notes: noteRows.map(
      (note): Note => ({
        id: note.id,
        date: note.date,
        body: note.body,
        visibility: note.visibility
      })
    ),
    timezone: settingsRow?.timezone ?? "UTC",
    now
  };
}
