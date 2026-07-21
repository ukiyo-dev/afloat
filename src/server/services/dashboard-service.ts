import {
  loadCachedLatestSyncRun,
  loadCachedPersonalRuleRecords,
  loadCachedPrivateView,
  loadCachedSettings
} from "@/server/services/dashboard-cache";
import {
  buildDashboardRangeView,
  parseDashboardDefaultRange,
  type DashboardDefaultRange,
  type DashboardRangeKey,
  type DashboardRangeRequest,
  type DashboardRangeView
} from "@/server/services/dashboard-range";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { getLocalOwnerId } from "@/server/services/owner-service";
import { localDayKey } from "@/server/domain/time";
import type { PrivateDerivedView } from "@/server/views/derived-view";
import {
  buildPersonalRuleViews,
  countFulfilledRulesInRange,
  type PersonalRuleView
} from "@/server/domain/personal-rules";

export type { DashboardRangeRequest } from "@/server/services/dashboard-range";

export interface DashboardData {
  view: PrivateDerivedView;
  range: DashboardRangeKey;
  rangeView: DashboardRangeView;
  latestSyncRun: {
    kind: string;
    status: string;
    rangeStartAt: string | null;
    rangeEndAt: string | null;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  settings: {
    publicPageEnabled: boolean;
    defaultDashboardRange: DashboardDefaultRange;
    timezone: string;
    threadStaleDays: number;
  };
  personalRules: PersonalRuleView[];
  formalRuleCount: number;
}

export async function loadDashboardData(request?: DashboardRangeRequest): Promise<DashboardData> {
  const ownerId = await getCurrentOwnerId();
  const [view, latestSyncRun, settings] = await Promise.all([
    loadCachedPrivateView(ownerId),
    loadCachedLatestSyncRun(ownerId),
    loadCachedSettings(ownerId)
  ]);
  const timezone = settings.timezone || "UTC";
  const personalRules = buildPersonalRuleViews(
    await loadCachedPersonalRuleRecords(ownerId),
    localDayKey(new Date(), timezone)
  );
  const rangeView = buildDashboardRangeView({
    view,
    request,
    fallbackRange: settings.defaultDashboardRange,
    timezone
  });
  rangeView.fulfilledRuleCount = countFulfilledRulesInRange(
    personalRules,
    rangeView.startDate,
    rangeView.endDate
  );

  return {
    view,
    range: rangeView.key,
    rangeView,
    latestSyncRun,
    settings: {
      publicPageEnabled: settings.publicPageEnabled,
      defaultDashboardRange: parseDashboardDefaultRange(settings.defaultDashboardRange) ?? {
        startOffsetDays: 0,
        endOffsetDays: 0
      },
      timezone,
      threadStaleDays: settings.threadStaleDays || 7
    },
    personalRules,
    formalRuleCount: personalRules.filter((rule) => rule.commitment === "signed").length
  };
}

export async function loadLocalVisitorDashboardData(
  request?: DashboardRangeRequest
): Promise<DashboardData | null> {
  const ownerId = await getLocalOwnerId();
  const settings = await loadCachedSettings(ownerId);
  if (!settings.publicPageEnabled) {
    return null;
  }
  return loadDashboardDataForOwner(ownerId, request, { visitorMode: true });
}

async function loadDashboardDataForOwner(
  ownerId: string,
  request?: DashboardRangeRequest,
  options: { visitorMode?: boolean } = {}
): Promise<DashboardData> {
  const [view, latestSyncRun, settings] = await Promise.all([
    loadCachedPrivateView(ownerId),
    loadCachedLatestSyncRun(ownerId),
    loadCachedSettings(ownerId)
  ]);
  const timezone = settings.timezone || "UTC";
  const visibleView = options.visitorMode ? visitorView(view) : view;
  const personalRules = buildPersonalRuleViews(
    await loadCachedPersonalRuleRecords(ownerId),
    localDayKey(new Date(), timezone)
  );
  const rangeView = buildDashboardRangeView({
    view: visibleView,
    request,
    fallbackRange: settings.defaultDashboardRange,
    timezone
  });
  rangeView.fulfilledRuleCount = countFulfilledRulesInRange(
    personalRules,
    rangeView.startDate,
    rangeView.endDate
  );

  return {
    view: visibleView,
    range: rangeView.key,
    rangeView,
    latestSyncRun,
    settings: {
      publicPageEnabled: settings.publicPageEnabled,
      defaultDashboardRange: parseDashboardDefaultRange(settings.defaultDashboardRange) ?? {
        startOffsetDays: 0,
        endOffsetDays: 0
      },
      timezone,
      threadStaleDays: settings.threadStaleDays || 7
    },
    personalRules: options.visitorMode ? [] : personalRules,
    formalRuleCount: personalRules.filter((rule) => rule.commitment === "signed").length
  };
}

function visitorView(view: PrivateDerivedView): PrivateDerivedView {
  return {
    ...view,
    notes: view.notes.filter((note) => note.visibility === "public")
  };
}
