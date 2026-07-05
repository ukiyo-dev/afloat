import { DashboardData } from "@/server/services/dashboard-service";
import { timeRange, kindLabel } from "../view-formatters";
import { semanticColorClass } from "../semantic-colors";
import { buildTimeTapeSlices } from "./time-tape-utils";

export function TimeTape({ 
  timeline, 
  timezone, 
  startDate, 
  endDate,
  visitorMode = false
}: { 
  timeline: DashboardData["view"]["timeline"]; 
  timezone: string;
  startDate: string;
  endDate: string;
  visitorMode?: boolean;
}) {
  if (timeline.length === 0) return null;

  // Calculate the total duration of the current view window
  const endMs = new Date(endDate).getTime();
  const isSingleLocalDay =
    localDayKey(startDate, timezone) === localDayKey(new Date(endMs - 1).toISOString(), timezone);
  const slices = buildTimeTapeSlices({ timeline, startDate, endDate });

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
         <h3 className="font-mono font-bold text-sm bg-ledger text-ledger-foreground inline-block px-2 py-1 uppercase">
            {isSingleLocalDay ? '日切片 (DAY TAPE)' : '宏观分布 (MACRO TAPE)'}
         </h3>
      </div>
      
      {/* The Brutalist Stacked Bar Container */}
      <div className="w-full h-12 border-2 border-ink bg-paper relative flex shadow-brutal overflow-visible">
        {slices.map((slice, idx) => {
          if (!slice.fact) {
            return (
              <div
                key={`tape-gap-${slice.startAt}-${slice.endAt}-${idx}`}
                className="h-full min-w-0 bg-paper"
                style={{ flexGrow: slice.durationMs, flexBasis: 0 }}
              />
            );
          }

          return (
            <div 
              key={`tape-${slice.startAt}-${slice.endAt}-${idx}`}
              className={`relative h-full min-w-0 hover:opacity-80 transition-opacity group/tape cursor-crosshair ${semanticColorClass(slice.fact.kind)}`}
              style={{ flexGrow: slice.durationMs, flexBasis: 0 }}
            >
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover/tape:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-ledger text-ledger-foreground p-2 font-mono text-xs whitespace-nowrap z-50 pointer-events-none shadow-brutal border border-paper transition-opacity text-center">
                {visitorMode ? (
                   <strong className="block">{kindLabel(slice.fact.kind)}</strong>
                ) : (
                   <strong className="block">{slice.fact.title}</strong>
                )}
                <div className="text-highlight mt-1 opacity-90">{timeRange(slice.startAt, slice.endAt, timezone)}</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Tape Scale / Axis */}
      {isSingleLocalDay ? (
        <div className="flex justify-between font-mono text-[10px] text-ink-light mt-2 px-1 border-t-2 border-ink pt-1">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      ) : null}
    </div>
  );
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
