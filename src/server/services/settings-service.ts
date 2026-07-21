import { db } from "@/server/db/client";
import { loadSettings, updateSettings } from "@/server/db/settings";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { invalidateDashboardCache } from "@/server/services/dashboard-cache-invalidation";
import { validateDashboardSettings } from "@/server/services/workbench-validation";
import {
  parseDashboardDefaultRange,
  serializeDashboardDefaultRange,
  type DashboardDefaultRange
} from "@/server/services/dashboard-range";

export interface PublicSettingsInput {
  publicPageEnabled: boolean;
}

export interface DashboardSettingsInput extends PublicSettingsInput {
  defaultDashboardRange: DashboardDefaultRange;
  timezone: string;
  threadStaleDays: number;
}

export async function saveDashboardSettings(input: DashboardSettingsInput) {
  validateDashboardSettings(input);
  const ownerId = await getCurrentOwnerId();
  const settings = await updateSettings(db, ownerId, {
    ...input,
    defaultDashboardRange: serializeDashboardDefaultRange(input.defaultDashboardRange)
  });
  invalidateDashboardCache(ownerId, "settings");
  return settings;
}

export async function loadDashboardSettings(): Promise<DashboardSettingsInput> {
  const ownerId = await getCurrentOwnerId();
  const settings = await loadSettings(db, ownerId);
  return {
    publicPageEnabled: settings.publicPageEnabled,
    defaultDashboardRange: parseDashboardDefaultRange(settings.defaultDashboardRange) ?? {
      startOffsetDays: 0,
      endOffsetDays: 0
    },
    timezone: settings.timezone || "UTC",
    threadStaleDays: settings.threadStaleDays || 7
  };
}
