import { db } from "@/server/db/client";
import { loadSettings } from "@/server/db/settings";
import { loadLatestSyncRun } from "@/server/db/sync-runs";
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
import { loadPersonalRuleViews } from "@/server/services/personal-rule-service";
import { loadPrivateView } from "@/server/services/view-service";
import { loadPrivateViewForOwner } from "@/server/services/view-service";
import { localDayKey } from "@/server/domain/time";
import type { PrivateDerivedView } from "@/server/views/derived-view";
import { countFulfilledRulesInRange, type PersonalRuleView } from "@/server/domain/personal-rules";

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
}

export async function loadDashboardData(request?: DashboardRangeRequest): Promise<DashboardData> {
  const ownerId = await getCurrentOwnerId();
  const [view, latestSyncRun, settings] = await Promise.all([
    loadPrivateView(),
    loadLatestSyncRun(db, ownerId),
    loadSettings(db, ownerId)
  ]);
  const timezone = settings.timezone || "UTC";
  const personalRules = await loadPersonalRuleViews(localDayKey(new Date(), timezone));
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
    latestSyncRun: latestSyncRun
      ? {
          kind: latestSyncRun.kind,
          status: latestSyncRun.status,
          rangeStartAt: latestSyncRun.rangeStartAt?.toISOString() ?? null,
          rangeEndAt: latestSyncRun.rangeEndAt?.toISOString() ?? null,
          errorMessage: latestSyncRun.errorMessage,
          startedAt: latestSyncRun.startedAt.toISOString(),
          finishedAt: latestSyncRun.finishedAt?.toISOString() ?? null
        }
      : null,
    settings: {
      publicPageEnabled: settings.publicPageEnabled,
      defaultDashboardRange: parseDashboardDefaultRange(settings.defaultDashboardRange) ?? {
        startOffsetDays: 0,
        endOffsetDays: 0
      },
      timezone,
      threadStaleDays: settings.threadStaleDays || 7
    },
    personalRules
  };
}

export async function loadLocalVisitorDashboardData(
  request?: DashboardRangeRequest
): Promise<DashboardData | null> {
  const ownerId = await getLocalOwnerId();
  const settings = await loadSettings(db, ownerId);
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
    loadPrivateViewForOwner(ownerId),
    loadLatestSyncRun(db, ownerId),
    loadSettings(db, ownerId)
  ]);
  const timezone = settings.timezone || "UTC";
  const visibleView = options.visitorMode ? visitorView(view) : view;
  const rangeView = buildDashboardRangeView({
    view: visibleView,
    request,
    fallbackRange: settings.defaultDashboardRange,
    timezone
  });

  return {
    view: visibleView,
    range: rangeView.key,
    rangeView,
    latestSyncRun: latestSyncRun
      ? {
          kind: latestSyncRun.kind,
          status: latestSyncRun.status,
          rangeStartAt: latestSyncRun.rangeStartAt?.toISOString() ?? null,
          rangeEndAt: latestSyncRun.rangeEndAt?.toISOString() ?? null,
          errorMessage: latestSyncRun.errorMessage,
          startedAt: latestSyncRun.startedAt.toISOString(),
          finishedAt: latestSyncRun.finishedAt?.toISOString() ?? null
        }
      : null,
    settings: {
      publicPageEnabled: settings.publicPageEnabled,
      defaultDashboardRange: parseDashboardDefaultRange(settings.defaultDashboardRange) ?? {
        startOffsetDays: 0,
        endOffsetDays: 0
      },
      timezone,
      threadStaleDays: settings.threadStaleDays || 7
    },
    personalRules: []
  };
}

function visitorView(view: PrivateDerivedView): PrivateDerivedView {
  return {
    ...view,
    notes: view.notes.filter((note) => note.visibility === "public")
  };
}
