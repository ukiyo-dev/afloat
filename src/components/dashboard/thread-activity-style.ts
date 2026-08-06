import type { DashboardData } from "@/server/services/dashboard-service";
import { isPlanActivityKind } from "@/server/domain/semantic-kinds";
import { threadIdentityKey } from "@/server/domain/thread-summary";

type Activity = { group: string; item: string; kind: string };
type Thread = DashboardData["view"]["threads"][number];

export function threadActivityKeys(threads: Thread[]): Set<string> {
  return new Set(threads.map((thread) => threadIdentityKey(thread.group, thread.item)));
}

export function isThreadActivity(activity: Activity, keys: Set<string>): boolean {
  return isPlanActivityKind(activity.kind) && keys.has(threadIdentityKey(activity.group, activity.item));
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
