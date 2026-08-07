import type { ThreadActivityAttribution } from "@/server/views/derived-view";
import { threadAttributionMinutes } from "@/server/domain/thread-attribution";

type Activity = {
  startAt: string;
  endAt: string;
  sourceEventId?: string | null;
  planEventId?: string | null;
};

export function isAttributedThreadActivity(
  activity: Activity,
  attributions: ThreadActivityAttribution[]
): boolean {
  return threadAttributionMinutes(activity, attributions) > 0;
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
