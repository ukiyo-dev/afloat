"use client";

import { Fragment, useState } from "react";
import { DashboardData } from "../../server/services/dashboard-service";
import { formatDuration, kindLabel } from "../view-formatters";
import { semanticColorClass } from "../semantic-colors";
import {
  buildMacroDistributionDays,
  filterMacroDistributionDay,
  type MacroThreadScope
} from "./macro-distribution-utils";
import { semanticThreadFillClass } from "./thread-activity-style";

type MacroFilter = "work" | "leisure" | "rest" | "all";

const macroFilters: Array<{ key: MacroFilter; label: string; kinds: string[] | null }> = [
  { key: "work", label: "工作", kinds: ["ideal", "idealFulfilled"] },
  { key: "leisure", label: "娱乐", kinds: ["leisure", "leisureFulfilled"] },
  { key: "rest", label: "休闲", kinds: ["rest", "restFulfilled"] },
  { key: "all", label: "ALL", kinds: null }
];

const threadScopes: Array<{ key: MacroThreadScope; label: string }> = [
  { key: "thread", label: "Thread" },
  { key: "non", label: "Non" }
];

export function MacroDistribution({
  timeline,
  planTimeline,
  now,
  timezone,
  startDate,
  endDate,
  threads = []
}: {
  timeline: DashboardData["view"]["timeline"];
  planTimeline: DashboardData["view"]["planTimeline"];
  now: string;
  timezone: string;
  startDate: string;
  endDate: string;
  threads?: DashboardData["view"]["threads"];
}) {
  const [filter, setFilter] = useState<MacroFilter>("all");
  const [selectedScopes, setSelectedScopes] = useState<Set<MacroThreadScope>>(
    () => new Set(["non", "thread"])
  );

  if (timeline.length === 0 && planTimeline.length === 0) return null;

  const allDays = buildMacroDistributionDays({ timeline, planTimeline, now, timezone, startDate, endDate, threads });
  const selectedKinds = macroFilters.find((item) => item.key === filter)?.kinds ?? null;
  const days = allDays.map((day) => filterMacroDistributionDay(day, selectedKinds, selectedScopes));
  const toggleScope = (scope: MacroThreadScope) => {
    setSelectedScopes((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };
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
    "ideal",
    "leisure",
    "rest",
    "idealFulfilled", 
    "leisureFulfilled", 
    "restFulfilled", 
    "externalShift", 
    "internalShift", 
    "unmapped"
  ];
  const segmentGroups = [
    ["ideal", "idealFulfilled"],
    ["leisure", "leisureFulfilled"],
    ["rest", "restFulfilled"],
    ["externalShift"],
    ["internalShift"],
    ["unmapped"]
  ];

  return (
    <div>
      <div className="mb-2 flex items-stretch justify-start">
         <div className="inline-flex border border-ledger bg-ledger" aria-label="Thread 归属过滤器">
           {threadScopes.map((scope) => (
             <button
               key={scope.key}
               type="button"
               className={`grid h-[28px] w-[28px] place-items-center border-r border-paper/30 last:border-r-0 transition-colors ${
                 selectedScopes.has(scope.key)
                   ? "bg-highlight text-ink-fixed"
                   : "bg-ledger text-ledger-foreground hover:bg-paper hover:text-ink-fixed"
               }`}
               onClick={() => toggleScope(scope.key)}
               aria-pressed={selectedScopes.has(scope.key)}
               aria-label={scope.label}
               title={scope.label}
             >
               {scope.key === "thread" ? (
                 <span aria-hidden className="block h-2.5 w-2.5 bg-current" />
               ) : (
                 <span aria-hidden className="block h-2.5 w-2.5 border-2 border-current" />
               )}
             </button>
           ))}
         </div>
         <h3 className="inline-flex items-center bg-ledger px-2 font-mono text-sm font-bold uppercase text-ledger-foreground">
            宏观分布
         </h3>
         <div className="inline-flex border border-ledger bg-ledger" aria-label="活动类型过滤器">
           {macroFilters.map((item) => (
             <button
               key={item.key}
               type="button"
               className={`grid h-[28px] w-[28px] place-items-center border-r border-paper/30 transition-colors last:border-r-0 ${
                 filter === item.key
                   ? "bg-highlight text-ink-fixed"
                   : "bg-ledger text-ledger-foreground hover:bg-highlight hover:text-ink-fixed"
               }`}
               onClick={() => setFilter(item.key)}
               aria-pressed={filter === item.key}
               aria-label={item.label}
               title={item.label}
             >
               <MacroFilterGlyph filter={item.key} />
             </button>
           ))}
         </div>
      </div>
      
      {/* Brutalist Chart Container */}
      <div className="w-full border-2 border-ink bg-paper shadow-brutal px-1 pb-1 pt-4">
        <div
          className="grid h-48 items-end gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 48px))`, justifyContent: "center" }}
        >
        {days.map((day) => {
          const heightPercent = Math.min(100, (day.total / maxDailyMinutes) * 100);
          const selectedThreadMinutes = Object.values(day.threadKinds).reduce((total, minutes) => total + minutes, 0);
          const selectedOutsideMinutes = Math.max(0, day.total - selectedThreadMinutes);
          
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
                {segmentGroups.map(kinds => {
                  const mins = kinds.reduce((total, kind) => total + (day.kinds[kind] || 0), 0);
                  if (mins === 0) return null;
                  
                  const threadMinutes = kinds.reduce((total, kind) => total + (day.threadKinds[kind] || 0), 0);
                  const outsideMinutes = Math.max(0, mins - threadMinutes);
                  return (
                    <Fragment key={kinds.join("-")}>
                      {outsideMinutes > 0 ? <div className={`w-full min-h-0 ${semanticColorClass(kinds[0])} ${semanticThreadFillClass(kinds[0], false)}`} style={{ flex: `${outsideMinutes} 1 0` }} /> : null}
                      {threadMinutes > 0 ? <div className={`w-full min-h-0 ${semanticColorClass(kinds[0])}`} style={{ flex: `${threadMinutes} 1 0` }} /> : null}
                    </Fragment>
                  );
                })}
              </div>
              
              {/* Tooltip (Hover) */}
              <div className="hidden group-hover/bar:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-ledger text-ledger-foreground p-3 shadow-brutal border-2 border-paper w-48 text-xs font-mono z-50 pointer-events-none">
                <div className="mb-2 font-bold border-b border-paper/20 pb-1 text-sm">{day.displayDate}</div>
                <div className="flex flex-col gap-1">
                  {selectedKinds === null ? kindOrder.map(kind => {
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
                    }) : (
                      <>
                        {selectedOutsideMinutes > 0 ? (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className={`inline-block h-2 w-2 border border-paper/30 ${semanticColorClass(selectedKinds[0])} ${semanticThreadFillClass(selectedKinds[0], false)}`} />
                              Non-Thread
                            </span>
                            <span className="font-bold">{formatDuration(selectedOutsideMinutes)}</span>
                          </div>
                        ) : null}
                        {selectedThreadMinutes > 0 ? (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className={`inline-block h-2 w-2 border border-paper/30 ${semanticColorClass(selectedKinds[0])}`} />
                              Thread
                            </span>
                            <span className="font-bold">{formatDuration(selectedThreadMinutes)}</span>
                          </div>
                        ) : null}
                      </>
                    )}
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

function MacroFilterGlyph({ filter }: { filter: MacroFilter }) {
  if (filter === "all") {
    return (
      <span aria-hidden className="grid grid-cols-2 gap-[2px]">
        <span className="block h-[5px] w-[5px] bg-semantic-work" />
        <span className="block h-[5px] w-[5px] bg-semantic-leisure" />
        <span className="block h-[5px] w-[5px] bg-semantic-rest" />
        <span className="block h-[5px] w-[5px] bg-ink-light" />
      </span>
    );
  }

  const colorClass = filter === "work"
    ? "bg-semantic-work"
    : filter === "leisure"
      ? "bg-semantic-leisure"
      : "bg-semantic-rest";

  return <span aria-hidden className={`block h-2.5 w-2.5 ${colorClass}`} />;
}
