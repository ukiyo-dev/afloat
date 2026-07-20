import { db } from "@/server/db/client";
import { createNote, deleteNote, updateNote, type NoteVisibility } from "@/server/db/notes";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { validateNote } from "@/server/services/workbench-validation";

export interface NoteInput {
  date: string;
  body: string;
  visibility: NoteVisibility;
  id?: string | null;
}

export async function saveNote(input: NoteInput) {
  validateNote(input);

  const ownerId = await getCurrentOwnerId();
  const values = {
    date: input.date,
    body: input.body,
    visibility: input.visibility
  };

  if (input.id) {
    return updateNote(db, ownerId, input.id, values);
  }

  return createNote(db, ownerId, values);
}

export async function deleteNoteById(noteId: string): Promise<void> {
  if (noteId.trim().length === 0) {
    throw new Error("noteId is required.");
  }
  const ownerId = await getCurrentOwnerId();
  await deleteNote(db, ownerId, noteId);
}
