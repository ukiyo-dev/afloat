import { db } from "@/server/db/client";
import { loadSettings, updateSettings } from "@/server/db/settings";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { validateDashboardSettings } from "@/server/services/workbench-validation";
import {
  isDashboardRange,
  type DashboardRange
} from "@/server/services/dashboard-range";

export interface PublicSettingsInput {
  publicPageEnabled: boolean;
}

export interface DashboardSettingsInput extends PublicSettingsInput {
  defaultDashboardRange: DashboardRange;
  timezone: string;
}

export async function saveDashboardSettings(input: DashboardSettingsInput) {
  validateDashboardSettings(input);
  const ownerId = await getCurrentOwnerId();
  return updateSettings(db, ownerId, input);
}

export async function loadDashboardSettings(): Promise<DashboardSettingsInput> {
  const ownerId = await getCurrentOwnerId();
  const settings = await loadSettings(db, ownerId);
  return {
    publicPageEnabled: settings.publicPageEnabled,
    defaultDashboardRange: isDashboardRange(settings.defaultDashboardRange)
      ? settings.defaultDashboardRange
      : "day",
    timezone: settings.timezone || "UTC"
  };
}
