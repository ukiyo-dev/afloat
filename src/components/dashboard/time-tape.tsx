import { DashboardData } from "@/server/services/dashboard-service";
import { timeRange, kindLabel } from "../view-formatters";
import { semanticColorClass } from "../semantic-colors";

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
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const totalMs = endMs - startMs;

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
         <h3 className="font-mono font-bold text-sm bg-ink text-white inline-block px-2 py-1 uppercase">
            {startDate.slice(0, 10) === endDate.slice(0, 10) || startDate.slice(0, 10) === new Date(new Date(endDate).getTime() - 1000).toISOString().slice(0, 10) ? '日切片 (DAY TAPE)' : '宏观分布 (MACRO TAPE)'}
         </h3>
      </div>
      
      {/* The Brutalist Stacked Bar Container */}
      <div className="w-full h-12 border-2 border-ink bg-paper relative flex shadow-[4px_4px_0_0_#111]">
        {timeline.map((fact, idx) => {
          const factStartMs = new Date(fact.startAt).getTime();
          const factEndMs = new Date(fact.endAt).getTime();
          
          // Clip fact to the view window
          const clippedStartMs = Math.max(startMs, factStartMs);
          const clippedEndMs = Math.min(endMs, factEndMs);
          
          if (clippedEndMs <= clippedStartMs) return null;

          const leftPercent = ((clippedStartMs - startMs) / totalMs) * 100;
          const widthPercent = ((clippedEndMs - clippedStartMs) / totalMs) * 100;

          // Add a tiny right border to separate adjacent blocks visually like a barcode
          return (
            <div 
              key={`tape-${fact.startAt}-${fact.endAt}-${idx}`}
              className={`absolute top-0 bottom-0 hover:opacity-80 transition-opacity group/tape cursor-crosshair ${semanticColorClass(fact.kind)}`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover/tape:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-ink text-white p-2 font-mono text-xs whitespace-nowrap z-50 pointer-events-none shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] border border-white transition-opacity text-center">
                {visitorMode ? (
                   <strong className="block">{kindLabel(fact.kind)}</strong>
                ) : (
                   <strong className="block">{fact.title}</strong>
                )}
                <div className="text-highlight mt-1 opacity-90">{timeRange(fact.startAt, fact.endAt, timezone)}</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Tape Scale / Axis */}
      {startDate.slice(0, 10) === endDate.slice(0, 10) || startDate.slice(0, 10) === new Date(new Date(endDate).getTime() - 1000).toISOString().slice(0, 10) ? (
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
