import { eq } from "drizzle-orm";

import { sampleInput } from "@/server/views/sample-data";

import { db } from "./client";
import { ensureLocalOwner } from "./owners";
import {
  calendarEventsRaw,
  calendarSources,
  notes,
  settings,
  threadDeclarations
} from "./schema";

export async function seedSampleData(): Promise<{ ownerId: string; events: number }> {
  const ownerId = await ensureLocalOwner(db);
  const sample = sampleInput();

  await db.delete(calendarEventsRaw).where(eq(calendarEventsRaw.ownerId, ownerId));
  await db.delete(calendarSources).where(eq(calendarSources.ownerId, ownerId));
  await db.delete(threadDeclarations).where(eq(threadDeclarations.ownerId, ownerId));
  await db.delete(notes).where(eq(notes.ownerId, ownerId));

  const sourceIdBySampleId = new Map<string, string>();

  for (const source of sample.calendarSources) {
    const [inserted] = await db
      .insert(calendarSources)
      .values({
        ownerId,
        provider: source.provider ?? "caldav",
        externalCalendarId: source.externalCalendarId ?? source.id,
        name: source.name,
        semantic: source.semantic,
        enabled: true
      })
      .returning({ id: calendarSources.id });

    if (!inserted) {
      throw new Error(`Failed to seed calendar source ${source.id}.`);
    }
    sourceIdBySampleId.set(source.id, inserted.id);
  }

  await db.insert(calendarEventsRaw).values(
    sample.rawEvents.map((event) => {
      const calendarSourceId = sourceIdBySampleId.get(event.calendarSourceId);
      if (!calendarSourceId) {
        throw new Error(`Missing seeded source for event ${event.id}.`);
      }

      return {
        ownerId,
        calendarSourceId,
        provider: "caldav",
        externalCalendarId: event.calendarSourceId,
        externalEventId: event.externalEventId ?? event.id,
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: event.timezone,
        title: event.title,
        rawIcs: event.rawIcs
      };
    })
  );

  await db.insert(threadDeclarations).values(
    sample.threadDeclarations.map((thread) => ({
      ownerId,
      group: thread.group,
      item: thread.item,
      expectedMinutes: thread.expectedMinutes,
      deadline: thread.deadline
    }))
  );

  await db.insert(notes).values(
    sample.notes.map((note) => ({
      ownerId,
      date: note.date,
      body: note.body,
      visibility: note.visibility
    }))
  );

  await db
    .insert(settings)
    .values({ ownerId })
    .onConflictDoUpdate({
      target: settings.ownerId,
      set: { ruleVersion: 1, publicPageEnabled: true }
    });

  return { ownerId, events: sample.rawEvents.length };
}
