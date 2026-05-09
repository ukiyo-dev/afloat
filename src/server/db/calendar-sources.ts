import { and, eq, inArray, sql } from "drizzle-orm";

import type { SemanticKind } from "@/server/domain/types";

import type { Database } from "./client";
import { calendarSources } from "./schema";

export interface MappedCalendarSource {
  id: string;
  credentialId: string | null;
  provider: string;
  externalCalendarId: string;
  name: string;
  semantic: SemanticKind;
  enabled: boolean;
}

export async function loadEnabledCalendarSources(database: Database, ownerId: string) {
  return database
    .select()
    .from(calendarSources)
    .where(and(eq(calendarSources.ownerId, ownerId), eq(calendarSources.enabled, true)));
}

export async function loadMappedCalendarSources(
  database: Database,
  ownerId: string,
  externalCalendarIds: string[]
): Promise<MappedCalendarSource[]> {
  if (externalCalendarIds.length === 0) {
    return [];
  }

  const rows = await database
    .select()
    .from(calendarSources)
    .where(
      and(
        eq(calendarSources.ownerId, ownerId),
        eq(calendarSources.provider, "caldav"),
        eq(calendarSources.enabled, true),
        inArray(calendarSources.externalCalendarId, externalCalendarIds)
      )
    );

  return rows;
}

export async function loadKnownCalendarSources(
  database: Database,
  ownerId: string,
  externalCalendarIds: string[]
): Promise<MappedCalendarSource[]> {
  if (externalCalendarIds.length === 0) {
    return [];
  }

  return database
    .select()
    .from(calendarSources)
    .where(
      and(
        eq(calendarSources.ownerId, ownerId),
        eq(calendarSources.provider, "caldav"),
        inArray(calendarSources.externalCalendarId, externalCalendarIds)
      )
    );
}

export async function refreshMappedCalendarSources(
  database: Database,
  ownerId: string,
  credentialId: string | null,
  calendars: Array<{ id: string; name: string }>
): Promise<void> {
  const mapped = await loadMappedCalendarSources(
    database,
    ownerId,
    calendars.map((calendar) => calendar.id)
  );
  const mappedIds = new Set(mapped.map((source) => source.externalCalendarId));

  await Promise.all(
    calendars
      .filter((calendar) => mappedIds.has(calendar.id))
      .map((calendar) =>
        database
          .insert(calendarSources)
          .values({
            ownerId,
            credentialId,
            provider: "caldav",
            externalCalendarId: calendar.id,
            name: calendar.name,
            semantic: mapped.find((source) => source.externalCalendarId === calendar.id)?.semantic ?? "ideal",
            enabled: true
          })
          .onConflictDoUpdate({
            target: [
              calendarSources.ownerId,
              calendarSources.provider,
              calendarSources.externalCalendarId
            ],
            set: {
              credentialId: sql`excluded.credential_id`,
              name: sql`excluded.name`,
              updatedAt: sql`now()`
            }
          })
      )
  );
}

export async function upsertCalendarSourceMapping(
  database: Database,
  ownerId: string,
  input: {
    credentialId?: string | null;
    externalCalendarId: string;
    name: string;
    semantic: SemanticKind;
    enabled?: boolean;
  }
): Promise<MappedCalendarSource> {
  const [row] = await database
    .insert(calendarSources)
    .values({
      ownerId,
      credentialId: input.credentialId ?? null,
      provider: "caldav",
      externalCalendarId: input.externalCalendarId,
      name: input.name,
      semantic: input.semantic,
      enabled: input.enabled ?? true
    })
    .onConflictDoUpdate({
      target: [
        calendarSources.ownerId,
        calendarSources.provider,
        calendarSources.externalCalendarId
      ],
      set: {
        credentialId: sql`excluded.credential_id`,
        name: sql`excluded.name`,
        semantic: sql`excluded.semantic`,
        enabled: sql`excluded.enabled`,
        updatedAt: sql`now()`
      }
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert calendar source mapping.");
  }

  return row;
}
