export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm">
      <div className="panel-brutal !py-8 !px-12 flex flex-col items-center gap-6 animate-pulse border-4 border-ink shadow-[12px_12px_0_0_#111] bg-highlight">
        <div className="flex gap-2">
          <div className="w-6 h-6 bg-ink animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-6 h-6 bg-ink animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-6 h-6 bg-ink animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="font-mono text-xl font-black text-ink tracking-widest uppercase">
          FETCHING LEDGER...
        </p>
      </div>
    </div>
  );
}
