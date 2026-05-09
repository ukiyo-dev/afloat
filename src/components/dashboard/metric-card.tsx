export function Metric({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <article className={`metric-box ${danger ? 'border-danger bg-danger/5 shadow-[4px_4px_0_0_#ff3333]' : highlight ? 'bg-highlight shadow-[4px_4px_0_0_#111]' : 'shadow-[4px_4px_0_0_#111]'}`}>
      <span className="font-mono text-xs font-bold uppercase text-ink/70 mb-2 block">{label}</span>
      <strong className={`font-mono text-3xl font-black ${danger ? 'text-danger' : 'text-ink'}`}>{value}</strong>
    </article>
  );
}

export function MetricItem({ label, value, compact, className = "" }: { label: string; value: string; compact?: boolean; className?: string }) {
  return (
    <div className={`flex ${compact ? 'flex-col gap-0' : 'justify-between items-end border-b border-dashed border-ink/20 pb-1'} ${className}`}>
      <dt className="font-mono text-[10px] uppercase font-bold text-ink/60 tracking-wider">{label}</dt>
      <dd className="font-mono text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}
