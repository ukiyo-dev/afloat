import { eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { notes } from "./schema";

export type NoteVisibility = "private" | "public";

export async function upsertNote(
  database: Database,
  ownerId: string,
  input: { date: string; body: string; visibility: NoteVisibility }
) {
  const [row] = await database
    .insert(notes)
    .values({
      ownerId,
      date: input.date,
      body: input.body,
      visibility: input.visibility
    })
    .onConflictDoUpdate({
      target: [notes.ownerId, notes.date],
      set: {
        body: sql`excluded.body`,
        visibility: sql`excluded.visibility`,
        updatedAt: sql`now()`
      }
    })
    .returning();

  if (!row) {
    throw new Error("Failed to save note.");
  }

  return row;
}

export async function deleteNote(database: Database, ownerId: string, date: string): Promise<void> {
  await database.delete(notes).where(sql`${notes.ownerId} = ${ownerId} and ${notes.date} = ${date}`);
}

export async function loadNotes(database: Database, ownerId: string) {
  return database.select().from(notes).where(eq(notes.ownerId, ownerId));
}
