import { unstable_cache } from "next/cache";

import { db } from "@/server/db/client";
import { loadSettings } from "@/server/db/settings";
import { loadLatestSyncRun } from "@/server/db/sync-runs";
import { loadPersonalRuleRecordsForOwner } from "@/server/services/personal-rule-service";
import { loadPrivateViewForOwner } from "@/server/services/view-service";
import { dashboardCacheTag } from "@/server/services/dashboard-cache-invalidation";

export function loadCachedPrivateView(ownerId: string) {
  return unstable_cache(
    () => loadPrivateViewForOwner(ownerId),
    ["dashboard-view", ownerId],
    { revalidate: false, tags: [dashboardCacheTag(ownerId, "view")] }
  )();
}

export function loadCachedSettings(ownerId: string) {
  return unstable_cache(
    async () => {
      const settings = await loadSettings(db, ownerId);
      return {
        publicPageEnabled: settings.publicPageEnabled,
        defaultDashboardRange: settings.defaultDashboardRange,
        timezone: settings.timezone,
        threadStaleDays: settings.threadStaleDays
      };
    },
    ["dashboard-settings", ownerId],
    { revalidate: false, tags: [dashboardCacheTag(ownerId, "settings")] }
  )();
}

export function loadCachedLatestSyncRun(ownerId: string) {
  return unstable_cache(
    async () => {
      const run = await loadLatestSyncRun(db, ownerId);
      return run
        ? {
            kind: run.kind,
            status: run.status,
            rangeStartAt: run.rangeStartAt?.toISOString() ?? null,
            rangeEndAt: run.rangeEndAt?.toISOString() ?? null,
            errorMessage: run.errorMessage,
            startedAt: run.startedAt.toISOString(),
            finishedAt: run.finishedAt?.toISOString() ?? null
          }
        : null;
    },
    ["dashboard-sync", ownerId],
    { revalidate: false, tags: [dashboardCacheTag(ownerId, "sync")] }
  )();
}

export function loadCachedPersonalRuleRecords(ownerId: string) {
  return unstable_cache(
    () => loadPersonalRuleRecordsForOwner(ownerId),
    ["dashboard-rules", ownerId],
    { revalidate: false, tags: [dashboardCacheTag(ownerId, "rules")] }
  )();
}
