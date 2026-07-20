import type { DashboardData } from "@/server/services/dashboard-service";
import type { ReactNode } from "react";
import { formatDuration } from "../view-formatters";
import { buildThreadLoadSegments } from "./thread-load-strip-utils";

export function ThreadLoadStrip({
  threads,
  today,
  headerEnd
}: {
  threads: DashboardData["view"]["threads"];
  today: string;
  headerEnd: ReactNode;
}) {
  const segments = buildThreadLoadSegments(threads, today);
  const peak = Math.max(...segments.map((segment) => segment.dailyMinutes), 1);

  return (
    <details suppressHydrationWarning className="group/strip mb-6">
      <summary className="block cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col items-stretch gap-2 md:flex-row md:items-end md:justify-between md:gap-4">
          <span className="flex items-end gap-3 sm:gap-5">
            <span>
              <span className="mb-1 block font-mono text-xs font-bold uppercase tracking-widest">Threads</span>
              <span className="block font-serif text-4xl font-black uppercase md:text-5xl">线程追踪</span>
            </span>
            {segments.length > 0 ? (
              <span className="mb-1 flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-widest sm:text-xs">
                <span className="transition-transform group-open/strip:rotate-90">▶</span>
                Daily Load
              </span>
            ) : null}
          </span>
          <span onClick={(event) => event.stopPropagation()}>{headerEnd}</span>
        </span>
        <span aria-hidden="true" className="mt-2 block h-1 w-full bg-ink" />
      </summary>

      {segments.length > 0 ? <div className="mt-4 w-full overflow-x-auto brutal-scrollbar pb-3">
        <div className="inline-flex min-w-max border-2 border-ink bg-paper align-top">
          {segments.map((segment, index) => {
            const change = index === 0 ? null : segment.dailyMinutes - segments[index - 1]!.dailyMinutes;
            const fill = segment.dailyMinutes === 0 ? 0 : Math.max(12, (segment.dailyMinutes / peak) * 100);

            return (
              <details
                suppressHydrationWarning
                className="group/load relative w-44 shrink-0 border-r-2 border-ink last:border-r-0"
                key={segment.start}
              >
                <summary className="relative block h-28 cursor-pointer list-none overflow-hidden p-3 select-none [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 bg-highlight transition-[height,filter] group-hover/load:brightness-95"
                    style={{ height: `${fill}%` }}
                  />
                  <span className="relative z-10 flex h-full flex-col justify-between">
                    <span className="flex items-start justify-between gap-3 font-mono text-[10px] font-bold uppercase tabular-nums">
                      <span>{index === 0 ? "Today" : shortDate(segment.start)}</span>
                      {change !== null && Math.abs(change) >= 0.5 ? (
                        <span>{change > 0 ? "▲" : "▼"} {formatSignedDuration(change)}</span>
                      ) : null}
                    </span>
                    <strong className="font-mono text-xl tabular-nums">
                      {segment.dailyMinutes > 0 ? formatDuration(Math.round(segment.dailyMinutes)) : "—"}
                      <span className="ml-1 text-[10px] font-bold">/ {segment.days} DAY</span>
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
                      {segment.contributions.map((item) => (
                        <li className="flex justify-between gap-4" key={item.key}>
                          <span className="min-w-0 truncate font-serif">{item.label}</span>
                          <strong className="shrink-0">{formatDuration(Math.round(item.dailyMinutes))}</strong>
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
