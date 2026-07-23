import type { DashboardData } from "@/server/services/dashboard-service";

type Activity = { group: string; item: string; kind: string };
type Thread = DashboardData["view"]["threads"][number];

export function threadActivityKeys(threads: Thread[]): Set<string> {
  return new Set(threads.map((thread) => activityKey(thread.group, thread.item)));
}

export function isThreadActivity(activity: Activity, keys: Set<string>): boolean {
  return isPlanActivity(activity.kind) && keys.has(activityKey(activity.group, activity.item));
}

export function semanticThreadFillClass(kind: string, belongsToThread: boolean): string {
  if (belongsToThread) return "";
  switch (kind) {
    case "ideal":
    case "idealFulfilled":
      return "muted-semantic-work";
    case "leisure":
    case "leisureFulfilled":
      return "muted-semantic-leisure";
    case "rest":
    case "restFulfilled":
      return "muted-semantic-rest";
    default:
      return "";
  }
}

function activityKey(group: string, item: string): string {
  return `${group}\u0000${item}`;
}

function isPlanActivity(kind: string): boolean {
  return kind === "ideal" || kind === "idealFulfilled" ||
    kind === "leisure" || kind === "leisureFulfilled" ||
    kind === "rest" || kind === "restFulfilled";
}
