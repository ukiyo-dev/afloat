export function Metric({ label, value, secondaryValue, subscriptValue, danger, success }: { label: string; value: string; secondaryValue?: string; subscriptValue?: string; danger?: boolean; success?: boolean }) {
  return (
    <article className={`metric-box ${danger ? 'border-danger bg-danger/5 shadow-[4px_4px_0_0_rgb(var(--color-danger))]' : success ? 'border-success bg-success/5 shadow-[4px_4px_0_0_rgb(var(--color-success))]' : 'bg-ink/5 shadow-brutal'}`}>
      <span className="mb-2 flex items-baseline gap-1 font-mono text-xs font-bold uppercase text-ink/70">
        <span>{label}</span>
        {subscriptValue ? <span className={`text-[10px] ${danger ? 'text-danger' : success ? 'text-success' : 'text-ink'}`}>{subscriptValue}</span> : null}
      </span>
      <strong className={`font-mono text-3xl font-black whitespace-nowrap ${danger ? 'text-danger' : success ? 'text-success' : 'text-ink'}`}>
        {value}
        {secondaryValue ? <span className="text-lg align-baseline">（{secondaryValue}）</span> : null}
      </strong>
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
