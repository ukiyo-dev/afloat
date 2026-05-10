"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeDashboardDefaultRange } from "@/server/services/dashboard-range";
import { saveCurrentCalDavCredential } from "@/server/services/caldav-credential-service";
import { saveCalendarSourceMapping } from "@/server/services/calendar-source-service";
import { isCalendarMappingValue } from "@/server/services/calendar-source-validation";
import { saveDashboardSettings } from "@/server/services/settings-service";
import { recomputeCurrentOwnerViews } from "@/server/services/view-service";

export async function saveSettingsAction(formData: FormData) {
  const publicPageEnabled = formData.get("publicPageEnabled") === "on";
  const defaultDashboardStartOffset = parseOffset(formData.get("defaultDashboardStartOffset"));
  const defaultDashboardEndOffset = parseOffset(formData.get("defaultDashboardEndOffset"));
  const timezone = formData.get("timezone");

  if (
    defaultDashboardStartOffset === null ||
    defaultDashboardEndOffset === null ||
    typeof timezone !== "string"
  ) {
    throw new Error("Invalid settings form data.");
  }

  // Validate that the timezone is a valid IANA timezone string
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch (e) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  await saveDashboardSettings({
    publicPageEnabled,
    defaultDashboardRange: normalizeDashboardDefaultRange({
      startOffsetDays: defaultDashboardStartOffset,
      endOffsetDays: defaultDashboardEndOffset
    }),
    timezone
  });
  await recomputeCurrentOwnerViews();
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings");
}

function parseOffset(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function saveSettingsCalendarMappingAction(formData: FormData) {
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
