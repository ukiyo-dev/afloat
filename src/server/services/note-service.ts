import { db } from "@/server/db/client";
import { deleteNote, upsertNote, type NoteVisibility } from "@/server/db/notes";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { validateNote, validateNoteDate } from "@/server/services/workbench-validation";

export interface NoteInput {
  date: string;
  body: string;
  visibility: NoteVisibility;
}

export async function saveNote(input: NoteInput) {
  validateNote(input);
  const ownerId = await getCurrentOwnerId();
  return upsertNote(db, ownerId, input);
}

export async function deleteNoteByDate(date: string): Promise<void> {
  validateNoteDate(date);
  const ownerId = await getCurrentOwnerId();
  await deleteNote(db, ownerId, date);
}
