import { formatDuration } from "../view-formatters";

export function FactDistribution({ 
  factTotals, 
  planTotals, 
  shiftComposition,
  factLayerTitle
}: { 
  factTotals: Record<string, number>; 
  planTotals: Record<string, number>;
  shiftComposition?: Record<string, { internal: number; external: number }>;
  factLayerTitle: string;
}) {
  if (Object.keys(factTotals).length === 0 && Object.keys(planTotals).length === 0) {
    return <p className="font-mono text-ink-light text-sm italic">当前没有{factLayerTitle}相关记录。</p>;
  }

  const shiftComp = shiftComposition || {
    ideal: { internal: 0, external: 0 },
    leisure: { internal: 0, external: 0 },
    rest: { internal: 0, external: 0 },
    unmapped: { internal: 0, external: 0 }
  };

  // Work, Leisure, Rest: show fulfilled + intShift + extShift inside the plan!
  const coreStats = [
    { 
      key: "ideal", 
      label: "工作", 
      fulfilled: factTotals.idealFulfilled ?? 0, 
      plan: planTotals.ideal ?? 0, 
      color: "bg-semantic-work",
      intShift: shiftComp.ideal?.internal ?? 0,
      extShift: shiftComp.ideal?.external ?? 0
    },
    { 
      key: "leisure", 
      label: "娱乐", 
      fulfilled: factTotals.leisureFulfilled ?? 0, 
      plan: planTotals.leisure ?? 0, 
      color: "bg-semantic-leisure",
      intShift: shiftComp.leisure?.internal ?? 0,
      extShift: shiftComp.leisure?.external ?? 0
    },
    { 
      key: "rest", 
      label: "休息", 
      fulfilled: factTotals.restFulfilled ?? 0, 
      plan: planTotals.rest ?? 0, 
      color: "bg-semantic-rest",
      intShift: shiftComp.rest?.internal ?? 0,
      extShift: shiftComp.rest?.external ?? 0
    },
  ].filter(stat => stat.plan > 0 || stat.fulfilled > 0 || stat.intShift > 0 || stat.extShift > 0);

  const intShift = factTotals.internalShift ?? 0;
  const extShift = factTotals.externalShift ?? 0;

  return (
    <div className="flex flex-col gap-6 font-mono text-sm">
      {coreStats.length > 0 && (
        <div className="flex flex-col gap-3">
          {coreStats.map((stat) => {
            return (
              <div className="grid grid-cols-[80px_1fr_100px] gap-4 items-center group" key={stat.key}>
                <span className="font-bold truncate">{stat.label}</span>
                
                {/* Visual scale container acting as a pure flex row, just like TIME COMPOSITION */}
                <div className={`h-8 border-2 border-ink bg-paper flex overflow-hidden shadow-[4px_4px_0_0_#111] group-hover:opacity-80 transition-opacity`}>
                  {/* Fulfilled (Solid Core Color) */}
                  {stat.fulfilled > 0 && (
                    <div 
                      className={`h-full ${stat.color} transition-all cursor-crosshair border-r border-ink last:border-r-0`} 
                      style={{ flexGrow: stat.fulfilled }}
                      title={`兑现: ${formatDuration(stat.fulfilled)}`}
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
                  <span className="text-xs text-ink-light">/ {formatDuration(stat.plan)}</span>
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
        
        <div className="h-8 border-2 border-ink bg-paper flex overflow-hidden shadow-[4px_4px_0_0_#111]">
          {/* Work */}
          {coreStats.find(s => s.key === 'ideal') && coreStats.find(s => s.key === 'ideal')!.fulfilled > 0 && (
            <div 
              className="h-full bg-semantic-work transition-all hover:opacity-80 cursor-crosshair border-r border-ink last:border-r-0" 
              style={{ flexGrow: coreStats.find(s => s.key === 'ideal')!.fulfilled }}
              title={`工作: ${formatDuration(coreStats.find(s => s.key === 'ideal')!.fulfilled)}`}
            />
          )}
          {/* Leisure */}
          {coreStats.find(s => s.key === 'leisure') && coreStats.find(s => s.key === 'leisure')!.fulfilled > 0 && (
            <div 
              className="h-full bg-semantic-leisure transition-all hover:opacity-80 cursor-crosshair border-r border-ink last:border-r-0" 
              style={{ flexGrow: coreStats.find(s => s.key === 'leisure')!.fulfilled }}
              title={`娱乐: ${formatDuration(coreStats.find(s => s.key === 'leisure')!.fulfilled)}`}
            />
          )}
          {/* Rest */}
          {coreStats.find(s => s.key === 'rest') && coreStats.find(s => s.key === 'rest')!.fulfilled > 0 && (
            <div 
              className="h-full bg-semantic-rest transition-all hover:opacity-80 cursor-crosshair border-r border-ink last:border-r-0" 
              style={{ flexGrow: coreStats.find(s => s.key === 'rest')!.fulfilled }}
              title={`休息: ${formatDuration(coreStats.find(s => s.key === 'rest')!.fulfilled)}`}
            />
          )}
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
