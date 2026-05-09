export type SyncKind = "recent" | "recalibrate";
export type SyncStatus = "succeeded" | "not_configured" | "failed";

export interface SyncResult {
  status: SyncStatus;
  kind: SyncKind;
  message: string;
  range?: {
    startAt: string;
    endAt: string;
  };
  calendars?: number;
  eventsFetched?: number;
  eventsUpserted?: number;
  eventsMarkedDeleted?: number;
  eventsRemovedFromCache?: number;
  generatedAt?: string;
}

export function syncStatusCode(result: SyncResult): number {
  if (result.status === "succeeded") {
    return 200;
  }
  if (result.status === "not_configured") {
    return 409;
  }
  return 502;
}
