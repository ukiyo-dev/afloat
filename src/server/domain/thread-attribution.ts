import { intersection } from "./time";
import type { ThreadActivityAttribution } from "../views/derived-view";

export function threadAttributionMinutes(
  activity: { startAt: string; endAt: string; sourceEventId?: string | null; planEventId?: string | null },
  attributions: ThreadActivityAttribution[]
): number {
  const range = { startAt: new Date(activity.startAt), endAt: new Date(activity.endAt) };
  if (!Number.isFinite(range.startAt.getTime()) || !Number.isFinite(range.endAt.getTime())) return 0;
  const overlaps = attributions.flatMap((attribution) => {
    const identityMatch = Boolean(
      (activity.sourceEventId && attribution.sourceEventId === activity.sourceEventId) ||
      (activity.planEventId && attribution.planEventId === activity.planEventId)
    );
    if (!identityMatch) return [];
    const overlap = intersection(range, {
      startAt: new Date(attribution.startAt),
      endAt: new Date(attribution.endAt)
    });
    return overlap ? [overlap] : [];
  }).sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

  let totalMs = 0;
  let mergedStart = 0;
  let mergedEnd = 0;
  for (const overlap of overlaps) {
    const start = overlap.startAt.getTime();
    const end = overlap.endAt.getTime();
    if (start > mergedEnd) {
      totalMs += Math.max(0, mergedEnd - mergedStart);
      mergedStart = start;
      mergedEnd = end;
    } else {
      mergedEnd = Math.max(mergedEnd, end);
    }
  }

  return (totalMs + Math.max(0, mergedEnd - mergedStart)) / 60_000;
}
