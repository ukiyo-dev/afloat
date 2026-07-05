import type { DashboardData } from "@/server/services/dashboard-service";

type TimelineFact = DashboardData["view"]["timeline"][number];

export interface TimeTapeSlice {
  startAt: string;
  endAt: string;
  durationMs: number;
  fact: TimelineFact | null;
}

interface ClippedFact {
  startMs: number;
  endMs: number;
  fact: TimelineFact;
}

export function buildTimeTapeSlices({
  timeline,
  startDate,
  endDate
}: {
  timeline: DashboardData["view"]["timeline"];
  startDate: string;
  endDate: string;
}): TimeTapeSlice[] {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const clippedFacts = timeline
    .map((fact) => {
      const factStartMs = new Date(fact.startAt).getTime();
      const factEndMs = new Date(fact.endAt).getTime();
      const clippedStartMs = Math.max(startMs, factStartMs);
      const clippedEndMs = Math.min(endMs, factEndMs);

      if (
        !Number.isFinite(factStartMs) ||
        !Number.isFinite(factEndMs) ||
        clippedEndMs <= clippedStartMs
      ) {
        return null;
      }

      return {
        startMs: clippedStartMs,
        endMs: clippedEndMs,
        fact
      };
    })
    .filter((fact): fact is ClippedFact => fact !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const boundaries = [...new Set([startMs, endMs, ...clippedFacts.flatMap((fact) => [fact.startMs, fact.endMs])])]
    .sort((a, b) => a - b);

  return boundaries.flatMap((sliceStartMs, index) => {
    const sliceEndMs = boundaries[index + 1];
    if (sliceEndMs === undefined || sliceEndMs <= sliceStartMs) {
      return [];
    }

    const fact = clippedFacts.find(
      (candidate) => candidate.startMs <= sliceStartMs && sliceEndMs <= candidate.endMs
    )?.fact ?? null;

    return [
      {
        startAt: new Date(sliceStartMs).toISOString(),
        endAt: new Date(sliceEndMs).toISOString(),
        durationMs: sliceEndMs - sliceStartMs,
        fact
      }
    ];
  });
}

export function nowMarkerPositionPercent({
  startDate,
  endDate,
  now,
  timezone
}: {
  startDate: string;
  endDate: string;
  now: string;
  timezone: string;
}): number | null {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const nowMs = new Date(now).getTime();

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    !Number.isFinite(nowMs) ||
    endMs <= startMs ||
    nowMs < startMs ||
    nowMs >= endMs
  ) {
    return null;
  }

  const endLocalDay = localDayKey(new Date(endMs - 1).toISOString(), timezone);
  const isSingleLocalDay = localDayKey(startDate, timezone) === endLocalDay;
  const isTodayTape = localDayKey(startDate, timezone) === localDayKey(now, timezone);

  if (!isSingleLocalDay || !isTodayTape) {
    return null;
  }

  return ((nowMs - startMs) / (endMs - startMs)) * 100;
}

function localDayKey(value: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(value));
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Keep rendering with a UTC fallback if the timezone is invalid.
  }

  return value.slice(0, 10);
}
