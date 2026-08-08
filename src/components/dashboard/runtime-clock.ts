import { floorToMinute } from "@/server/domain/time";

const MS_PER_MINUTE = 60_000;

export function minuteNowIso(value = new Date()): string {
  return floorToMinute(value).toISOString();
}

export function millisecondsUntilNextMinute(nowMs = Date.now()): number {
  return MS_PER_MINUTE - (nowMs % MS_PER_MINUTE);
}
