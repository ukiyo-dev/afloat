"use server";

import { revalidatePath } from "next/cache";

import { saveCalendarSourceMapping } from "@/server/services/calendar-source-service";
import { isCalendarMappingValue } from "@/server/services/calendar-source-validation";
import { deleteNoteByDate, saveNote } from "@/server/services/note-service";
import { syncRecent, syncRecalibrate } from "@/server/services/sync-service";
import { parseDurationInput } from "@/server/services/duration-input";
import {
  deleteEmptyThreadDeclaration,
  saveThreadDeclaration
} from "@/server/services/thread-declaration-service";
import { recomputeCurrentOwnerViews } from "@/server/services/view-service";

export async function runRecentSyncAction() {
  await syncRecent();
  revalidatePath("/dashboard");
}

export async function runRecalibrateAction() {
  await syncRecalibrate();
  revalidatePath("/dashboard");
}

export async function recomputeViewsAction() {
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}

export async function saveCalendarMappingAction(formData: FormData) {
  const externalCalendarId = formData.get("externalCalendarId");
  const name = formData.get("name");
  const semantic = formData.get("semantic");

  if (
    typeof externalCalendarId !== "string" ||
    typeof name !== "string" ||
    !isCalendarMappingValue(semantic)
  ) {
    throw new Error("Invalid calendar mapping form data.");
  }

  await saveCalendarSourceMapping({
    externalCalendarId,
    name,
    semantic,
    enabled: semantic !== "none"
  });
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}

export async function saveThreadDeclarationAction(formData: FormData) {
  const group = formData.get("group");
  const item = formData.get("item");
  const expectedMinutes = formData.get("expectedMinutes");
  const deadline = formData.get("deadline");

  if (typeof group !== "string" || typeof item !== "string") {
    throw new Error("Invalid thread declaration form data.");
  }

  await saveThreadDeclaration({
    group,
    item,
    expectedMinutes: parseDurationInput(expectedMinutes),
    deadline:
      typeof deadline === "string" && deadline.trim() !== ""
        ? new Date(`${deadline}T00:00:00.000Z`)
        : null
  });
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}

export async function deleteThreadDeclarationAction(formData: FormData) {
  const group = formData.get("group");
  const item = formData.get("item");

  if (typeof group !== "string" || typeof item !== "string") {
    throw new Error("Invalid thread deletion form data.");
  }

  await deleteEmptyThreadDeclaration(group, item);
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}

export async function saveNoteAction(formData: FormData) {
  const date = formData.get("date");
  const body = formData.get("body");
  const visibility = formData.get("visibility");

  if (
    typeof date !== "string" ||
    typeof body !== "string" ||
    (visibility !== "private" && visibility !== "public")
  ) {
    throw new Error("Invalid note form data.");
  }

  await saveNote({ date, body, visibility });
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}

export async function deleteNoteAction(formData: FormData) {
  const date = formData.get("date");

  if (typeof date !== "string") {
    throw new Error("Invalid note deletion form data.");
  }

  await deleteNoteByDate(date);
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}
