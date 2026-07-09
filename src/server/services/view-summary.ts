import type { DerivedViews } from "@/server/views/derived-view";
import type { DashboardRangeView } from "@/server/services/dashboard-range";

export interface RecomputeSummary {
  generatedAt: string;
  private: {
    plannedMinutes: number;
    fulfillmentRate: number | null;
    protocolErrors: number;
    threads: number;
  };
  range?: {
    label: string;
    startDate: string;
    endDate: string;
    startAt: string;
    endAt: string;
    plannedMinutes: number;
    plannedDays: number;
    observedPlannedMinutes: number;
    observedPlannedDays: number;
    averagePlannedMinutes: number;
    fulfilledPlanMinutes: number;
    internalFulfilledPlanMinutes: number;
    internalFulfillmentRate: number | null;
    fulfillmentRate: number | null;
    maintenanceRate: number;
    protocolErrors: number;
  };
}

export function summarizeViews(
  views: DerivedViews,
  rangeView?: DashboardRangeView
): RecomputeSummary {
  return {
    generatedAt: views.private.generatedAt,
    private: {
      plannedMinutes: views.private.plannedMinutes,
      fulfillmentRate: views.private.fulfillmentRate,
      protocolErrors: views.private.protocolErrors.length,
      threads: views.private.threads.length
    },
    range: rangeView
      ? {
          label: rangeView.label,
          startDate: rangeView.startDate,
          endDate: rangeView.endDate,
          startAt: rangeView.startAt,
          endAt: rangeView.endAt,
          plannedMinutes: rangeView.plannedMinutes,
          plannedDays: rangeView.plannedDays,
          observedPlannedMinutes: rangeView.observedPlannedMinutes,
          observedPlannedDays: rangeView.observedPlannedDays,
          averagePlannedMinutes: rangeView.averagePlannedMinutes,
          fulfilledPlanMinutes: rangeView.fulfilledPlanMinutes,
          internalFulfilledPlanMinutes: rangeView.internalFulfilledPlanMinutes,
          internalFulfillmentRate: rangeView.internalFulfillmentRate,
          fulfillmentRate: rangeView.fulfillmentRate,
          maintenanceRate: rangeView.maintenanceRate,
          protocolErrors: rangeView.protocolErrors.length
        }
      : undefined
  };
}
