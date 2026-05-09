import { DashboardData } from "@/server/services/dashboard-service";
import { timeRange, kindLabel, formatDuration } from "../view-formatters";
import { semanticColorClass } from "../semantic-colors";

export function Timeline({ 
  timeline, 
  timezone, 
  factLayerTitle 
}: { 
  timeline: DashboardData["view"]["timeline"]; 
  timezone: string; 
  factLayerTitle: string 
}) {
  if (timeline.length === 0) {
    return (
      <div className="border-2 border-dashed border-ink/20 p-8 text-center">
        <p className="font-mono text-ink-light text-sm">当前时间范围内没有{factLayerTitle}相关记录。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col font-mono text-sm max-h-[320px] overflow-y-auto brutal-scrollbar pr-2 mr-[-8px]">
      {timeline.map((fact, idx) => (
        <div 
          className="flex flex-col md:grid md:grid-cols-[120px_100px_1fr_60px] gap-2 md:gap-4 py-3 border-b border-ink/20 hover:bg-highlight/10 transition-colors px-2 -mx-2" 
          key={`${fact.startAt}-${fact.endAt}-${fact.kind}-${idx}`}
        >
          <div className="flex justify-between md:contents">
            <span className="text-ink-light">{timeRange(fact.startAt, fact.endAt, timezone)}</span>
            <strong className="md:hidden text-right">{formatDuration(fact.minutes)}</strong>
          </div>
          
          <div className="flex items-start gap-3 md:contents">
            <strong className={`shrink-0 px-1 text-center truncate border border-ink ${semanticColorClass(fact.kind)}`}>{kindLabel(fact.kind)}</strong>
            <span className="font-serif text-base leading-tight break-all md:break-normal">{fact.title}</span>
          </div>
          
          <strong className="hidden md:block text-right">{formatDuration(fact.minutes)}</strong>
        </div>
      ))}
    </div>
  );
}
