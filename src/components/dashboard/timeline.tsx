import { DashboardData } from "@/server/services/dashboard-service";
import { kindLabel, formatDuration, timelineTimeRange } from "../view-formatters";
import { semanticTagColorClass } from "../semantic-colors";
import { isThreadActivity, semanticThreadFillClass, threadActivityKeys } from "./thread-activity-style";

export function Timeline({ 
  timeline, 
  timezone,
  startDate,
  threads
}: { 
  timeline: DashboardData["view"]["timeline"]; 
  timezone: string;
  startDate: string;
  threads: DashboardData["view"]["threads"];
}) {
  if (timeline.length === 0) {
    return (
      <div className="border-2 border-dashed border-ink/20 p-8 text-center">
        <p className="font-mono text-ink-light text-sm">当前时间范围内没有相关记录。</p>
      </div>
    );
  }

  const threadKeys = threadActivityKeys(threads);

  return (
    <div className="flex flex-col font-mono text-sm max-h-[320px] overflow-y-auto brutal-scrollbar pr-2 mr-[-8px]">
      {timeline.map((fact, idx) => {
        const range = timelineTimeRange(fact.startAt, fact.endAt, timezone, startDate);

        return (
          <div
            className="flex flex-col md:grid md:grid-cols-[136px_100px_1fr_60px] gap-2 md:gap-4 py-3 border-b border-ink/20 hover:bg-highlight/10 transition-colors px-2 -mx-2"
            key={`${fact.startAt}-${fact.endAt}-${fact.kind}-${idx}`}
          >
            <div className="flex justify-between md:contents">
              <span className="grid grid-cols-[24px_92px_24px] items-baseline text-ink-light tabular-nums whitespace-nowrap">
                <DayOffset value={range.startDayOffset} side="start" />
                <span>{range.startTime}-{range.endTime}</span>
                <DayOffset value={range.endDayOffset} side="end" />
              </span>
              <strong className="md:hidden text-right">{formatDuration(fact.minutes)}</strong>
            </div>

            <div className="flex items-start gap-3 md:contents">
              <strong className={`shrink-0 px-1 text-center truncate border ${semanticTagColorClass(fact.kind)} ${semanticThreadFillClass(fact.kind, isThreadActivity(fact, threadKeys))}`}>{kindLabel(fact.kind)}</strong>
              <span className="font-serif text-base leading-tight break-all md:break-normal">{fact.title}</span>
            </div>

            <strong className="hidden md:block text-right">{formatDuration(fact.minutes)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function DayOffset({ value, side }: { value: number; side: "start" | "end" }) {
  if (value === 0) {
    return <span aria-hidden="true" />;
  }

  return (
    <sup
      className={`relative -top-1 block px-0.5 text-[10px] font-bold leading-none text-ink ${
        side === "start" ? "text-right" : "text-left"
      }`}
    >
      {value > 0 ? `+${value}` : value}
    </sup>
  );
}
