import { DashboardData } from "../../server/services/dashboard-service";
import { formatDuration, kindLabel } from "../view-formatters";
import { semanticColorClass } from "../semantic-colors";
import { buildMacroDistributionDays } from "./macro-distribution-utils";

export function MacroDistribution({
  timeline,
  timezone,
  startDate,
  endDate
}: {
  timeline: DashboardData["view"]["timeline"];
  timezone: string;
  startDate: string;
  endDate: string;
}) {
  if (timeline.length === 0) return null;

  const days = buildMacroDistributionDays({ timeline, timezone, startDate, endDate });
  const visibleLabelDates = new Set(
    days.length <= 7
      ? days.map((day) => day.date)
      : [
          days[0]?.date,
          days[Math.floor((days.length - 1) / 2)]?.date,
          days[days.length - 1]?.date
        ].filter((date): date is string => Boolean(date))
  );

  // Minimum cap at 12 hours (720m) for visual balance if days are low.
  const maxDailyMinutes = Math.max(720, ...days.map(d => d.total));

  // Match the visual stack order with the tooltip order, top to bottom.
  const kindOrder = [
    "idealFulfilled", 
    "leisureFulfilled", 
    "restFulfilled", 
    "externalShift", 
    "internalShift", 
    "unmapped"
  ];

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
         <h3 className="font-mono font-bold text-sm bg-ledger text-ledger-foreground inline-block px-2 py-1 uppercase">
            宏观分布 (MACRO DISTRIBUTION)
         </h3>
      </div>
      
      {/* Brutalist Chart Container */}
      <div className="w-full border-2 border-ink bg-paper shadow-brutal px-1 pb-1 pt-4">
        <div
          className="grid h-48 items-end gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 48px))`, justifyContent: "center" }}
        >
        {days.map((day) => {
          const heightPercent = Math.min(100, (day.total / maxDailyMinutes) * 100);
          
          return (
            <div 
              key={day.date} 
              className="group/bar relative flex min-w-0 flex-col justify-end h-full transition-transform hover:-translate-y-0.5"
            >
              {/* Stacked Segments container */}
              <div 
                className={`w-full flex flex-col justify-end overflow-hidden bg-paper transition-shadow duration-200 ${
                  heightPercent > 0 ? 'border border-ink shadow-[2px_2px_0_0_rgb(var(--color-shadow))] group-hover/bar:shadow-[3px_3px_0_0_rgb(var(--color-shadow))]' : ''
                }`}
                style={{ height: `${heightPercent}%` }}
              >
                {kindOrder.map(kind => {
                  const mins = day.kinds[kind] || 0;
                  if (mins === 0) return null;
                  
                  const segHeightPercent = (mins / day.total) * 100;
                  
                  return (
                    <div 
                      key={kind}
                      className={`w-full ${semanticColorClass(kind)}`}
                      style={{ height: `${segHeightPercent}%` }}
                    />
                  );
                })}
              </div>
              
              {/* Tooltip (Hover) */}
              <div className="hidden group-hover/bar:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-ledger text-ledger-foreground p-3 shadow-brutal border-2 border-paper w-48 text-xs font-mono z-50 pointer-events-none">
                <div className="mb-2 font-bold border-b border-paper/20 pb-1 text-sm">{day.displayDate}</div>
                <div className="flex flex-col gap-1">
                  {kindOrder.map(kind => {
                    const mins = day.kinds[kind] || 0;
                    if (mins === 0) return null;
                    return (
                      <div key={kind} className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                           <span className={`w-2 h-2 inline-block ${semanticColorClass(kind)} border border-paper/30`}></span>
                           {kindLabel(kind)}
                        </span>
                        <span className="font-bold">{formatDuration(mins)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center mt-2 pt-1 border-t border-paper/20">
                    <span className="text-paper/60">Total</span>
                    <span className="font-bold">{formatDuration(day.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      
      {/* X-Axis Labels */}
      <div
        className="grid gap-[2px] font-mono text-[10px] text-ink-light mt-2 px-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 48px))`, justifyContent: "center" }}
      >
        {days.map((day) => (
          <span key={day.date} className="min-w-0 text-center">
            {visibleLabelDates.has(day.date) ? day.displayDate : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
