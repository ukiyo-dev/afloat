import { DashboardData } from "../../server/services/dashboard-service";
import { formatDuration, kindLabel } from "../view-formatters";
import { semanticColorClass } from "../semantic-colors";

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

  // 1. Generate dates array (YYYY-MM-DD) based on local timezone
  const days: { date: string; displayDate: string; total: number; kinds: Record<string, number> }[] = [];
  
  // We parse startDate and endDate as local dates in the requested timezone
  // Assuming startDate and endDate are already localized YYYY-MM-DD strings
  const [startY, startM, startD] = startDate.split('-').map(Number);
  const [endY, endM, endD] = endDate.split('-').map(Number);
  
  let cur = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));
  
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    // Format display date ignoring timezone since we created a UTC date that represents local time
    const displayDate = `${cur.getUTCMonth() + 1}月${cur.getUTCDate()}日`;
    days.push({ date: dateStr, displayDate, total: 0, kinds: {} });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // 2. Map timeline to days
  for (const fact of timeline) {
    // Get local date of the fact based on startAt
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(fact.startAt));
    
    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;
    
    if (!y || !m || !d) continue;
    const localDateStr = `${y}-${m}-${d}`;
    
    const dayData = days.find(d => d.date === localDateStr);
    if (dayData) {
      dayData.total += fact.minutes;
      dayData.kinds[fact.kind] = (dayData.kinds[fact.kind] || 0) + fact.minutes;
    }
  }

  // 3. Find max daily total to set the chart height. Minimum cap at 12 hours (720m) for visual balance if days are low.
  const maxDailyMinutes = Math.max(720, ...days.map(d => d.total));

  // The order of kinds from bottom to top
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
         <h3 className="font-mono font-bold text-sm bg-ink text-white inline-block px-2 py-1 uppercase">
            宏观分布 (MACRO DISTRIBUTION)
         </h3>
      </div>
      
      {/* Brutalist Chart Container */}
      <div className="w-full h-48 border-2 border-ink bg-paper relative flex justify-center items-end gap-[2px] shadow-[4px_4px_0_0_#111] px-1 pb-1 pt-4">
        
        {days.map((day) => {
          const heightPercent = Math.min(100, (day.total / maxDailyMinutes) * 100);
          
          return (
            <div 
              key={day.date} 
              className="group/bar relative flex-1 max-w-[48px] flex flex-col justify-end h-full transition-transform hover:-translate-y-0.5"
            >
              {/* Stacked Segments container */}
              <div 
                className={`w-full flex flex-col justify-end overflow-hidden bg-paper transition-shadow duration-200 ${
                  heightPercent > 0 ? 'border border-ink shadow-[2px_2px_0_0_#111] group-hover/bar:shadow-[3px_3px_0_0_#111]' : ''
                }`}
                style={{ height: `${heightPercent}%` }}
              >
                {[...kindOrder].reverse().map(kind => {
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
              <div className="opacity-0 group-hover/bar:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-ink text-white p-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] border-2 border-white w-48 text-xs font-mono z-50 pointer-events-none transition-opacity">
                <div className="mb-2 font-bold border-b border-white/20 pb-1 text-sm">{day.displayDate}</div>
                <div className="flex flex-col gap-1">
                  {kindOrder.map(kind => {
                    const mins = day.kinds[kind] || 0;
                    if (mins === 0) return null;
                    return (
                      <div key={kind} className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                           <span className={`w-2 h-2 inline-block ${semanticColorClass(kind)} border border-white/30`}></span>
                           {kindLabel(kind)}
                        </span>
                        <span className="font-bold">{formatDuration(mins)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/20">
                    <span className="text-white/60">Total</span>
                    <span className="font-bold">{formatDuration(day.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* X-Axis Labels */}
      <div className="flex justify-between font-mono text-[10px] text-ink-light mt-2 px-1">
        <span>{days[0]?.displayDate}</span>
        {days.length > 7 && (
          <span className="text-center">{days[Math.floor(days.length / 2)]?.displayDate}</span>
        )}
        <span>{days[days.length - 1]?.displayDate}</span>
      </div>
    </div>
  );
}
