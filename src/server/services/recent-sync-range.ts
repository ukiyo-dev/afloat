import { addDays } from "@/server/domain/time";

const RECENT_SYNC_DAYS = 14;

export function recentSyncRange(now: Date): { startAt: Date; endAt: Date } {
  return {
    startAt: addDays(now, -RECENT_SYNC_DAYS),
    endAt: addDays(now, RECENT_SYNC_DAYS)
  };
}
