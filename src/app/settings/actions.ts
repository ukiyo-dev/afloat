"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidTimeZone, normalizeDashboardDefaultRange } from "@/server/services/dashboard-range";
import { saveCurrentCalDavCredential } from "@/server/services/caldav-credential-service";
import { saveCalendarMappingFromForm } from "@/server/services/calendar-source-action-service";
import { saveDashboardSettings } from "@/server/services/settings-service";
import { recomputeCurrentOwnerViews } from "@/server/services/view-service";

export async function saveSettingsAction(formData: FormData) {
  const publicPageEnabled = formData.get("publicPageEnabled") === "on";
  const defaultDashboardStartOffset = parseOffset(formData.get("defaultDashboardStartOffset"));
  const defaultDashboardEndOffset = parseOffset(formData.get("defaultDashboardEndOffset"));
  const threadStaleDays = parsePositiveInteger(formData.get("threadStaleDays"));
  const timezone = formData.get("timezone");

  if (
    defaultDashboardStartOffset === null ||
    defaultDashboardEndOffset === null ||
    threadStaleDays === null ||
    typeof timezone !== "string"
  ) {
    throw new Error("Invalid settings form data.");
  }

  if (!isValidTimeZone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  await saveDashboardSettings({
    publicPageEnabled,
    defaultDashboardRange: normalizeDashboardDefaultRange({
      startOffsetDays: defaultDashboardStartOffset,
      endOffsetDays: defaultDashboardEndOffset
    }),
    timezone,
    threadStaleDays
  });
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings");
}

function parsePositiveInteger(value: FormDataEntryValue | null): number | null {
  const parsed = parseOffset(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseOffset(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function saveSettingsCalendarMappingAction(formData: FormData) {
  await saveCalendarMappingFromForm(formData);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function saveCalDavCredentialAction(formData: FormData) {
  const serverUrl = formData.get("serverUrl");
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof serverUrl !== "string" || typeof username !== "string") {
    throw new Error("Invalid CalDAV credential form data.");
  }

  await saveCurrentCalDavCredential({
    serverUrl,
    username,
    password: typeof password === "string" && password.trim() !== "" ? password : null
  });
  revalidatePath("/settings");
  redirect("/settings");
}
