import { db } from "@/server/db/client";
import { loadPrivateComputedViewRow, saveComputedViews } from "@/server/db/computed-views";
import { loadDerivedViewInput } from "@/server/db/derived-input";
import { loadSettings } from "@/server/db/settings";
import {
  buildDashboardRangeView,
  type DashboardRangeRequest
} from "@/server/services/dashboard-range";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { summarizeViews, type RecomputeSummary } from "@/server/services/view-summary";
import {
  buildDerivedViews,
  type DerivedViews,
  type PrivateDerivedView
} from "@/server/views/derived-view";

export async function recomputeViewsForOwner(
  ownerId?: string,
  now = new Date()
): Promise<DerivedViews> {
  const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId());
  const [input, settings] = await Promise.all([
    loadDerivedViewInput(db, resolvedOwnerId, now),
    loadSettings(db, resolvedOwnerId)
  ]);
  const views = buildDerivedViews(input);
  const ruleVersion = currentRuleVersion(settings.ruleVersion);

  await saveComputedViews(db, resolvedOwnerId, ruleVersion, views);
  return views;
}

export async function loadPrivateView(): Promise<PrivateDerivedView> {
  const ownerId = await getCurrentOwnerId();
  return loadPrivateViewForOwner(ownerId);
}

export async function loadPrivateViewForOwner(ownerId: string): Promise<PrivateDerivedView> {
  const [existing, settings] = await Promise.all([
    loadPrivateComputedViewRow(db, ownerId),
    loadSettings(db, ownerId)
  ]);
  if (existing && existing.ruleVersion === currentRuleVersion(settings.ruleVersion)) {
    const payload = existing.payload as PrivateDerivedView;
    if (payload.maintenanceTimeline) {
      return payload;
    }
  }

  const recomputed = await recomputeViewsForOwner(ownerId);
  return recomputed.private;
}

export async function recomputeCurrentOwnerViews(
  request?: DashboardRangeRequest
): Promise<RecomputeSummary> {
  const ownerId = await getCurrentOwnerId();
  const [views, settings] = await Promise.all([
    recomputeViewsForOwner(ownerId),
    loadSettings(db, ownerId)
  ]);
  const rangeView = buildDashboardRangeView({
    view: views.private,
    request,
    fallbackRange: settings.defaultDashboardRange,
    timezone: settings.timezone || "UTC"
  });

  return summarizeViews(views, rangeView);
}

function currentRuleVersion(settingsRuleVersion: number): number {
  return settingsRuleVersion || Number.parseInt(process.env.RULE_VERSION ?? "1", 10);
}
