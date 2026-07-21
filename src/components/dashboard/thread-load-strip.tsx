import type { DashboardData } from "@/server/services/dashboard-service";
import type { CSSProperties, ReactNode } from "react";
import { formatDuration } from "../view-formatters";
import { apportionDisplayMinutes, buildThreadLoadSegments } from "./thread-load-strip-utils";

export function ThreadLoadStrip({
  threads,
  today,
  timezone,
  headerEnd
}: {
  threads: DashboardData["view"]["threads"];
  today: string;
  timezone: string;
  headerEnd: ReactNode;
}) {
  const segments = buildThreadLoadSegments(threads, today, timezone);
  const peak = Math.max(...segments.flatMap((segment) => [segment.dailyMinutes, segment.originalDailyMinutes]), 1);

  return (
    <details suppressHydrationWarning className="thread-load-strip group/strip mb-6">
      <summary className="block cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col items-stretch gap-2 md:flex-row md:items-end md:justify-between md:gap-4">
          <span>
            <span>
              <span className="mb-1 flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-widest">
                <span>Threads</span>
                {segments.length > 0 ? (
                  <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                    <span className="transition-transform group-open/strip:rotate-90">▶</span>
                    Daily Load
                  </span>
                ) : null}
              </span>
              <span className="block font-serif text-4xl font-black uppercase md:text-5xl">线程追踪</span>
            </span>
          </span>
          <span onClick={(event) => event.stopPropagation()}>{headerEnd}</span>
        </span>
        <span aria-hidden="true" className="mt-2 block h-1 w-full bg-ink" />
      </summary>

      {segments.length > 0 ? <div className="mt-4 w-full overflow-x-auto brutal-scrollbar pb-3">
        <div className="inline-flex min-w-max items-start bg-paper align-top">
          {segments.map((segment, index) => {
            const displayMinutes = segment.dailyMinutes === 0 ? 0 : Math.ceil(segment.dailyMinutes);
            const displayContributions = apportionDisplayMinutes(segment.contributions, displayMinutes);
            const change = index === 0 ? null : segment.dailyMinutes - segments[index - 1]!.dailyMinutes;
            const fixedFill = (segment.steadyDailyMinutes / peak) * 100;
            const originalFlexibleFill = ((segment.originalDailyMinutes - segment.steadyDailyMinutes) / peak) * 100;
            const levelledFlexibleFill = ((segment.dailyMinutes - segment.steadyDailyMinutes) / peak) * 100;
            const loadStyle = {
              "--load-fixed": `${fixedFill}%`,
              "--load-from": `${Math.max(0, originalFlexibleFill)}%`,
              "--load-to": `${Math.max(0, levelledFlexibleFill)}%`
            } as CSSProperties;

            return (
              <details
                suppressHydrationWarning
                className="group/load relative -ml-0.5 w-44 shrink-0 border-2 border-ink first:ml-0"
                key={segment.start}
              >
                <summary className="relative block h-28 cursor-pointer list-none overflow-hidden p-3 select-none [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="load-fixed absolute inset-x-0 bottom-0 bg-highlight" style={loadStyle} />
                  <span aria-hidden="true" className="load-flex absolute inset-x-0 bg-highlight group-hover/load:brightness-95" style={loadStyle} />
                  <span className="relative z-10 flex h-full flex-col justify-between">
                    <span className="flex items-start justify-between gap-3 font-mono text-[10px] font-bold uppercase tabular-nums">
                      <span>{index === 0 ? "Today" : shortDate(segment.start)}</span>
                      {change !== null && Math.abs(change) >= 0.5 ? (
                        <span>{change > 0 ? "▲" : "▼"} {formatSignedDuration(change)}</span>
                      ) : null}
                    </span>
                    <strong className={`font-mono text-xl tabular-nums ${displayMinutes < 0 ? "text-semantic-rest" : ""}`}>
                      {displayMinutes !== 0 ? formatDuration(displayMinutes) : "—"}
                      {index > 0 ? (
                        <span className="ml-1 text-[10px] font-bold">/ {segment.days} DAY</span>
                      ) : null}
                    </strong>
                  </span>
                </summary>

                <div className="border-t-2 border-ink bg-surface p-3 font-mono text-xs">
                  <div className="mb-2 flex justify-between gap-3 font-bold uppercase">
                    <span>{dateRange(segment.start, segment.end)}</span>
                    <span>{segment.days}D</span>
                  </div>
                  {segment.contributions.length > 0 ? (
                    <ul className="space-y-1 border-t border-dashed border-ink/40 pt-2">
                      {displayContributions.map((item) => (
                        <li className="flex justify-between gap-4" key={item.key}>
                          <span className="min-w-0 truncate font-serif">{item.label}</span>
                          <strong className={`shrink-0 ${item.displayMinutes < 0 ? "text-semantic-rest" : ""}`}>
                            {formatDuration(item.displayMinutes)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-ink-light">No bounded commitments.</p>}
                </div>
              </details>
            );
          })}
        </div>
      </div> : null}
    </details>
  );
}

function shortDate(day: string): string {
  return day.slice(5).replace("-", "/");
}

function dateRange(start: string, end: string): string {
  return start === end ? start : `${start} — ${end}`;
}

function formatSignedDuration(minutes: number): string {
  return `${minutes > 0 ? "+" : "−"}${formatDuration(Math.round(Math.abs(minutes)))}`;
}
