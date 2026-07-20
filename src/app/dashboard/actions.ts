"use server";

import { revalidatePath } from "next/cache";

import { saveCalendarSourceMapping } from "@/server/services/calendar-source-service";
import { isCalendarMappingValue } from "@/server/services/calendar-source-validation";
import { deleteNoteById, saveNote } from "@/server/services/note-service";
import { syncRecent, syncRecalibrate } from "@/server/services/sync-service";
import { parseDurationInput } from "@/server/services/duration-input";
import {
  deleteEmptyThreadDeclaration,
  saveThreadDeclaration
} from "@/server/services/thread-declaration-service";
import {
  deletePersonalRule,
  recordPersonalRuleBreak,
  savePersonalRule,
  signRule,
  stopPersonalRule
} from "@/server/services/personal-rule-service";
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
  const steadyDaily = formData.get("steadyDaily") === "true";
  const start = formData.get("start");
  const deadline = formData.get("deadline");

  if (typeof group !== "string" || typeof item !== "string") {
    throw new Error("Invalid thread declaration form data.");
  }

  await saveThreadDeclaration({
    group,
    item,
    expectedMinutes: parseDurationInput(expectedMinutes),
    steadyDaily,
    start:
      typeof start === "string" && start.trim() !== ""
        ? new Date(`${start}T00:00:00.000Z`)
        : null,
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

export async function savePersonalRuleAction(formData: FormData) {
  const title = formData.get("title");
  const content = formData.get("content");
  const startDate = formData.get("startDate");
  const commitment = formData.get("commitment");

  if (
    typeof title !== "string" ||
    typeof content !== "string" ||
    typeof startDate !== "string" ||
    (commitment !== "test" && commitment !== "signed")
  ) {
    throw new Error("Invalid personal rule form data.");
  }

  await savePersonalRule({ title, content, startDate, commitment });
  revalidatePath("/dashboard");
}

export async function signPersonalRuleAction(formData: FormData) {
  const ruleId = formData.get("ruleId");
  if (typeof ruleId !== "string") throw new Error("Invalid personal rule sign form data.");
  await signRule(ruleId);
  revalidatePath("/dashboard");
}

export async function recordPersonalRuleBreakAction(formData: FormData) {
  const ruleId = formData.get("ruleId");
  const brokenDate = formData.get("brokenDate");
  const scene = formData.get("scene");
  const reason = formData.get("reason");

  if (
    typeof ruleId !== "string" ||
    typeof brokenDate !== "string" ||
    typeof scene !== "string" ||
    typeof reason !== "string"
  ) {
    throw new Error("Invalid personal rule break form data.");
  }

  await recordPersonalRuleBreak({ ruleId, brokenDate, scene, reason });
  revalidatePath("/dashboard");
}

export async function stopPersonalRuleAction(formData: FormData) {
  const ruleId = formData.get("ruleId");
  const archiveReason = formData.get("archiveReason");

  if (typeof ruleId !== "string") {
    throw new Error("Invalid personal rule archive form data.");
  }

  await stopPersonalRule({
    ruleId,
    archiveReason: typeof archiveReason === "string" ? archiveReason : null
  });
  revalidatePath("/dashboard");
}

export async function deletePersonalRuleAction(formData: FormData) {
  const ruleId = formData.get("ruleId");

  if (typeof ruleId !== "string") {
    throw new Error("Invalid personal rule deletion form data.");
  }

  await deletePersonalRule(ruleId);
  revalidatePath("/dashboard");
}

export async function saveNoteAction(formData: FormData) {
  const id = formData.get("id");
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

  await saveNote({
    date,
    body,
    visibility,
    id: typeof id === "string" && id.trim() !== "" ? id : null
  });
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}

export async function deleteNoteAction(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string") {
    throw new Error("Invalid note deletion form data.");
  }

  await deleteNoteById(id);
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
}
