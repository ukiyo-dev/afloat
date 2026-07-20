import { and, eq } from "drizzle-orm";

import type { Database } from "./client";
import { notes } from "./schema";

export type NoteVisibility = "private" | "public";

export async function createNote(
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
    .returning();

  if (!row) {
    throw new Error("Failed to save note.");
  }

  return row;
}

export async function updateNote(
  database: Database,
  ownerId: string,
  noteId: string,
  input: { date: string; body: string; visibility: NoteVisibility }
) {
  const [row] = await database
    .update(notes)
    .set({
      date: input.date,
      body: input.body,
      visibility: input.visibility,
      updatedAt: new Date()
    })
    .where(and(eq(notes.ownerId, ownerId), eq(notes.id, noteId)))
    .returning();

  if (!row) {
    throw new Error("Note not found.");
  }

  return row;
}

export async function deleteNote(database: Database, ownerId: string, noteId: string): Promise<void> {
  await database.delete(notes).where(and(eq(notes.ownerId, ownerId), eq(notes.id, noteId)));
}

export async function loadNotes(database: Database, ownerId: string) {
  return database.select().from(notes).where(eq(notes.ownerId, ownerId));
}
