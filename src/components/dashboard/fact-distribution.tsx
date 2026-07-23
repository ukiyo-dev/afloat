import { formatDuration } from "../view-formatters";
import type { DashboardData } from "@/server/services/dashboard-service";
import { isThreadActivity, semanticThreadFillClass, threadActivityKeys } from "./thread-activity-style";

export function FactDistribution({ 
  factTotals, 
  planTotals, 
  shiftComposition,
  activePlanDays,
  timeline,
  threads,
  rangeStartAt,
  rangeEndAt
}: { 
  factTotals: Record<string, number>; 
  planTotals: Record<string, number>;
  shiftComposition?: Record<string, { internal: number; external: number }>;
  activePlanDays: number;
  timeline: DashboardData["view"]["timeline"];
  threads: DashboardData["view"]["threads"];
  rangeStartAt: string;
  rangeEndAt: string;
}) {
  if (Object.keys(factTotals).length === 0 && Object.keys(planTotals).length === 0) {
    return <p className="font-mono text-ink-light text-sm italic">当前时间范围内没有相关记录。</p>;
  }

  const shiftComp = shiftComposition || {
    ideal: { internal: 0, external: 0 },
    leisure: { internal: 0, external: 0 },
    rest: { internal: 0, external: 0 },
    unmapped: { internal: 0, external: 0 }
  };
  const threadKeys = threadActivityKeys(threads);
  const rangeStartMs = new Date(rangeStartAt).getTime();
  const rangeEndMs = new Date(rangeEndAt).getTime();
  const threadMinutesByKind = timeline.reduce<Record<string, number>>((totals, fact) => {
    if (!isThreadActivity(fact, threadKeys)) return totals;
    const start = Math.max(rangeStartMs, new Date(fact.startAt).getTime());
    const end = Math.min(rangeEndMs, new Date(fact.endAt).getTime());
    if (end > start) totals[fact.kind] = (totals[fact.kind] ?? 0) + (end - start) / 60_000;
    return totals;
  }, {});

  // Work, Leisure, Rest: show fulfilled + intShift + extShift inside the plan!
  const coreStats = [
    { 
      key: "ideal", 
      label: "工作", 
      fulfilled: factTotals.idealFulfilled ?? 0, 
      threadFulfilled: threadMinutesByKind.idealFulfilled ?? 0,
      plan: planTotals.ideal ?? 0, 
      color: "bg-semantic-work",
      intShift: shiftComp.ideal?.internal ?? 0,
      extShift: shiftComp.ideal?.external ?? 0
    },
    { 
      key: "leisure", 
      label: "娱乐", 
      fulfilled: factTotals.leisureFulfilled ?? 0, 
      threadFulfilled: threadMinutesByKind.leisureFulfilled ?? 0,
      plan: planTotals.leisure ?? 0, 
      color: "bg-semantic-leisure",
      intShift: shiftComp.leisure?.internal ?? 0,
      extShift: shiftComp.leisure?.external ?? 0
    },
    { 
      key: "rest", 
      label: "休息", 
      fulfilled: factTotals.restFulfilled ?? 0, 
      threadFulfilled: threadMinutesByKind.restFulfilled ?? 0,
      plan: planTotals.rest ?? 0, 
      color: "bg-semantic-rest",
      intShift: shiftComp.rest?.internal ?? 0,
      extShift: shiftComp.rest?.external ?? 0
    },
  ].filter(stat => stat.plan > 0 || stat.fulfilled > 0 || stat.intShift > 0 || stat.extShift > 0);

  const intShift = factTotals.internalShift ?? 0;
  const extShift = factTotals.externalShift ?? 0;
  const activeDayAverage = (minutes: number) => activePlanDays > 0 ? minutes / activePlanDays : 0;

  return (
    <div className="flex flex-col gap-6 font-mono text-sm">
      {coreStats.length > 0 && (
        <div className="flex flex-col gap-3">
          {coreStats.map((stat) => {
            const outsideFulfilled = Math.max(0, stat.fulfilled - stat.threadFulfilled);
            return (
              <div className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] gap-2 items-center group sm:grid-cols-[80px_minmax(0,1fr)_100px] sm:gap-4" key={stat.key}>
                <span className="font-bold truncate min-w-0">{stat.label}</span>
                
                {/* Visual scale container acting as a pure flex row, just like TIME COMPOSITION */}
                <div className="h-8 border-2 border-ink bg-paper flex overflow-hidden shadow-brutal group-hover:opacity-80 transition-opacity">
                  {/* Fulfilled (Solid Core Color) */}
                  {stat.threadFulfilled > 0 && (
                    <div 
                      className={`h-full ${stat.color} transition-all cursor-crosshair border-r border-ink last:border-r-0`} 
                      style={{ flexGrow: stat.threadFulfilled }}
                      title={`兑现: ${formatDuration(stat.threadFulfilled)}`}
                    />
                  )}
                  {outsideFulfilled > 0 && (
                    <div
                      className={`h-full ${stat.color} ${semanticThreadFillClass(stat.key, false)} transition-all cursor-crosshair border-r border-ink last:border-r-0`}
                      style={{ flexGrow: outsideFulfilled }}
                      title={`兑现: ${formatDuration(outsideFulfilled)}`}
                    />
                  )}
                  {/* External Shift (Amber) */}
                  {stat.extShift > 0 && (
                    <div 
                      className={`h-full bg-semantic-ext transition-all cursor-crosshair border-r border-ink last:border-r-0`} 
                      style={{ flexGrow: stat.extShift }}
                      title={`外部偏移: ${formatDuration(stat.extShift)}`}
                    />
                  )}
                  {/* Internal Shift (Red) */}
                  {stat.intShift > 0 && (
                    <div 
                      className={`h-full bg-semantic-int transition-all cursor-crosshair border-r border-ink last:border-r-0`} 
                      style={{ flexGrow: stat.intShift }}
                      title={`内部偏移: ${formatDuration(stat.intShift)}`}
                    />
                  )}
                </div>
                
                <div className="flex flex-col text-right">
                  <strong>{formatDuration(stat.fulfilled)}</strong>
                  <span
                    className="text-xs text-ink-light"
                    title={`活跃日: ${activePlanDays} 天`}
                  >
                    / {formatDuration(activeDayAverage(stat.fulfilled))}
                  </span>
                  {(stat.extShift > 0 || stat.intShift > 0) && (
                    <span className="text-[10px] mt-1 flex flex-col items-end gap-0.5">
                      {stat.extShift > 0 && <span className="text-[#a16207] font-bold">+{formatDuration(stat.extShift)} 外部</span>}
                      {stat.intShift > 0 && <span className="text-semantic-int font-bold">+{formatDuration(stat.intShift)} 内部</span>}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* A Global Stacked Bar showing the absolute Day composition: Fulfilled vs Shifts */}
      <div className="pt-4 border-t-2 border-dashed border-ink/20">
        <p className="text-xs text-ink-light uppercase font-bold tracking-widest mb-2">TIME COMPOSITION</p>
        
        <div className="h-8 border-2 border-ink bg-paper flex overflow-hidden shadow-brutal">
          {/* Work */}
          {coreStats.flatMap((stat) => {
            const outside = Math.max(0, stat.fulfilled - stat.threadFulfilled);
            return [
              stat.threadFulfilled > 0 ? <div key={`${stat.key}-thread`} className={`h-full ${stat.color} transition-all hover:opacity-80 cursor-crosshair border-r border-ink last:border-r-0`} style={{ flexGrow: stat.threadFulfilled }} title={`${stat.label}: ${formatDuration(stat.threadFulfilled)}`} /> : null,
              outside > 0 ? <div key={`${stat.key}-outside`} className={`h-full ${stat.color} ${semanticThreadFillClass(stat.key, false)} transition-all hover:opacity-80 cursor-crosshair border-r border-ink last:border-r-0`} style={{ flexGrow: outside }} title={`${stat.label}: ${formatDuration(outside)}`} /> : null
            ];
          })}
          {/* External Shift */}
          {extShift > 0 && (
            <div 
              className="h-full bg-semantic-ext transition-all hover:opacity-80 cursor-crosshair border-r border-ink last:border-r-0" 
              style={{ flexGrow: extShift }}
              title={`外部偏移: ${formatDuration(extShift)}`}
            />
          )}
          {/* Internal Shift */}
          {intShift > 0 && (
            <div 
              className="h-full bg-semantic-int transition-all hover:opacity-80 cursor-crosshair" 
              style={{ flexGrow: intShift }}
              title={`内部偏移: ${formatDuration(intShift)}`}
            />
          )}
        </div>
        
        <div className="flex justify-between mt-2 text-xs font-mono text-ink-light">
          <span>兑现 (FULFILLED)</span>
          <span>偏移 (SHIFTS)</span>
        </div>
      </div>
    </div>
  );
}
