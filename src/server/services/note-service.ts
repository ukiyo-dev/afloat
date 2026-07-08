import { db } from "@/server/db/client";
import { deleteNote, upsertNote, type NoteVisibility } from "@/server/db/notes";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { validateNote, validateNoteDate } from "@/server/services/workbench-validation";

export interface NoteInput {
  date: string;
  body: string;
  visibility: NoteVisibility;
  originalDate?: string | null;
}

export async function saveNote(input: NoteInput) {
  validateNote(input);
  if (input.originalDate) {
    validateNoteDate(input.originalDate);
  }

  const ownerId = await getCurrentOwnerId();
  if (input.originalDate && input.originalDate !== input.date) {
    await deleteNote(db, ownerId, input.originalDate);
  }

  return upsertNote(db, ownerId, {
    date: input.date,
    body: input.body,
    visibility: input.visibility
  });
}

export async function deleteNoteByDate(date: string): Promise<void> {
  validateNoteDate(date);
  const ownerId = await getCurrentOwnerId();
  await deleteNote(db, ownerId, date);
}
