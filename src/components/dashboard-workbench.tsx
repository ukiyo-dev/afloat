"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarIcon, UpdateIcon, CheckIcon } from "@radix-ui/react-icons";

import { BrutalDialog } from "@/components/brutal-dialog";
import { ActionForm } from "@/components/action-form";
import { logoutAction } from "@/app/login/actions";
import {
  formatGeneratedAt,
  formatDuration,
  percent,
  timeRange
} from "@/components/view-formatters";
import type { DashboardData } from "@/server/services/dashboard-service";


import { JournalPanel } from "./dashboard/journal-panel";
import { ThreadPanel } from "./dashboard/thread-panel";
import { SyncPanel } from "./dashboard/sync-panel";
import { FactDistribution } from "./dashboard/fact-distribution";
import { Timeline } from "./dashboard/timeline";
import { TimeTape } from "./dashboard/time-tape";

import { MacroDistribution } from "./dashboard/macro-distribution";

import { Metric } from "./dashboard/metric-card";
import { 
  groupThreads, 
  protocolErrorLabel, 
  todayKey, 
  addLocalDaysKey,
  syncKindLabel,
  syncStatusLabel
} from "./dashboard/utils";


function getFactLayerTitle(startDate: string, endDate: string, timezone: string) {
  if (startDate !== endDate) {
    return "岁月篇章";
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  
  if (endDate < today) return "往日重现";
  if (startDate > today) return "未雨绸缪";
  return "现在进行";
}

export function DashboardWorkbench({
  view,
  rangeView,
  latestSyncRun,
  visitorMode = false,
  isOwner = false,
  basePath = "/dashboard"
}: DashboardData & { visitorMode?: boolean; isOwner?: boolean; basePath?: string }) {
  const searchParams = useSearchParams();
  
  const buildHref = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(newParams)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const guestModeHref = buildHref({ viewAs: visitorMode ? null : 'guest' });

  const threadGroups = view.threadGroups ?? groupThreads(view.threads);
  const urgentThreads = threadGroups.filter((thread) =>
    ["expired", "imbalanced", "tightPace", "needsScheduling"].includes(thread.status)
  );
  
  const factLayerTitle = getFactLayerTitle(rangeView.startDate, rangeView.endDate, rangeView.timezone);

  const [startY, startM, startD] = rangeView.startDate.split('-').map(Number);
  const [endY, endM, endD] = rangeView.endDate.split('-').map(Number);
  const startUtc = Date.UTC(startY, startM - 1, startD);
  const endUtc = Date.UTC(endY, endM - 1, endD);
  const daysCount = Math.round((endUtc - startUtc) / 86400000) + 1;
  const isUltraMacro = daysCount > 30;

  return (
    <main className="shell">
      {/* Header Section */}
      <section className="mb-8 border-b-4 border-ink pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            {isOwner ? (
              <Link
                href={guestModeHref}
                className="font-mono text-highlight bg-ink inline-block px-2 py-1 font-bold tracking-widest text-xs border border-ink hover:bg-highlight hover:text-ink transition-colors cursor-pointer"
                title={visitorMode ? "Switch to Owner Mode" : "View as Guest"}
              >
                {visitorMode ? "GUEST MODE" : "OWNER MODE"}
              </Link>
            ) : (
              <p className="font-mono text-highlight bg-ink inline-block px-2 py-1 font-bold tracking-widest text-xs border border-ink">
                GUEST MODE
              </p>
            )}
            <span className="font-mono text-ink-light text-sm">
              {formatGeneratedAt(view.generatedAt, rangeView.timezone)}
            </span>
          </div>
          
          <h1 className="font-serif text-5xl md:text-7xl font-black text-ink leading-none tracking-tighter mb-4">
            浮生
          </h1>
          <p className="font-serif text-xl md:text-2xl font-normal text-ink-light max-w-2xl text-balance">
            <span className="bg-highlight px-1 text-ink">{rangeView.label}</span> / {rangeView.timezone}
          </p>
        </div>

        <div className="panel-brutal !p-4 min-w-[240px] flex flex-col gap-4">
          <div className="flex justify-between items-start">
             <div>
                <span className="block font-mono text-xs text-ink-light mb-1">SYNC STATUS</span>
                <strong className="font-mono text-lg block mb-1">
                  {latestSyncRun ? syncKindLabel(latestSyncRun.kind) : "NO SYNC"}
                </strong>
                <span className="font-mono text-xs flex items-center gap-1">
                  {latestSyncRun?.status === 'succeeded' ? <CheckIcon className="text-success" /> : null}
                  {latestSyncRun ? syncStatusLabel(latestSyncRun.status) : "---"}
                </span>
             </div>
             {latestSyncRun?.status === 'running' && <UpdateIcon className="animate-spin text-ink" />}
          </div>
          
          <div className="ledger-border-t pt-3 mt-1 flex justify-between items-center">
            {visitorMode ? (
              <Link href="/login" className="font-mono text-sm font-bold hover:underline hover:text-highlight hover:bg-ink px-2 py-1 transition-colors">
                OWNER LOGIN →
              </Link>
            ) : (
              <>
                <Link href="/settings" className="font-mono text-sm font-bold hover:underline">
                  SETTINGS
                </Link>
                <ActionForm action={logoutAction}>
                  <button type="submit" className="font-mono text-sm font-bold text-danger hover:underline">
                    LOGOUT
                  </button>
                </ActionForm>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Range Navigation */}
      <div className="mb-8 flex flex-col xl:flex-row gap-6 xl:items-end justify-between bg-white border-2 border-ink p-4 shadow-[4px_4px_0_0_#111]">
        <nav className="flex flex-wrap gap-2" aria-label="Dashboard range">
          <RangeLink
            active={false}
            href={buildHref({ range: "day", date: addLocalDaysKey(rangeView.startDate, -1), start: null, end: null })}
            label="←"
            title="上一天"
          />
          <RangeLink
            active={rangeView.startDate === addLocalDaysKey(todayKey(rangeView.timezone), -1) && rangeView.endDate === addLocalDaysKey(todayKey(rangeView.timezone), -1)}
            href={buildHref({ range: "day", date: addLocalDaysKey(todayKey(rangeView.timezone), -1), start: null, end: null })}
            label="昨天"
          />
          <RangeLink
            active={rangeView.startDate === todayKey(rangeView.timezone) && rangeView.endDate === todayKey(rangeView.timezone)}
            href={buildHref({ range: "day", date: todayKey(rangeView.timezone), start: null, end: null })}
            label="今天"
          />
          <RangeLink
            active={rangeView.startDate === addLocalDaysKey(todayKey(rangeView.timezone), 1) && rangeView.endDate === addLocalDaysKey(todayKey(rangeView.timezone), 1)}
            href={buildHref({ range: "day", date: addLocalDaysKey(todayKey(rangeView.timezone), 1), start: null, end: null })}
            label="明天"
          />
          <RangeLink
            active={false}
            href={buildHref({ range: "day", date: addLocalDaysKey(rangeView.startDate, 1), start: null, end: null })}
            label="→"
            title="下一天"
          />
          <span className="w-px bg-ink mx-2"></span>
          <RangeLink active={rangeView.key === "7d"} href={buildHref({ range: "7d", date: null, start: null, end: null })} label="最近 7 天" />
          <RangeLink active={rangeView.key === "30d"} href={buildHref({ range: "30d", date: null, start: null, end: null })} label="最近 30 天" />
          <RangeLink active={rangeView.key === "90d"} href={buildHref({ range: "90d", date: null, start: null, end: null })} label="最近 90 天" />
        </nav>

        <form className="flex flex-wrap items-end gap-3" action={basePath}>
          <input type="hidden" name="range" value="custom" />
          {visitorMode && <input type="hidden" name="viewAs" value="guest" />}
          <label className="font-mono text-xs flex flex-col gap-1">
            <span className="uppercase font-bold">Start Date</span>
            <input className="input-brutal w-40" name="start" type="date" defaultValue={rangeView.startDate} />
          </label>
          <label className="font-mono text-xs flex flex-col gap-1">
            <span className="uppercase font-bold">End Date</span>
            <input className="input-brutal w-40" name="end" type="date" defaultValue={rangeView.endDate} />
          </label>
          <button className="btn-brutal h-[40px] flex items-center gap-2" type="submit">
            <CalendarIcon /> 统计
          </button>
        </form>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Metric label="平均计划时间" value={formatDuration(rangeView.averagePlannedMinutes)} />
        <Metric
          label="兑现率"
          value={rangeView.fulfillmentRate === null ? "---" : percent(rangeView.fulfillmentRate)}
          highlight={rangeView.fulfillmentRate !== null && rangeView.fulfillmentRate < 0.5}
        />
        <Metric label="维护率" value={percent(rangeView.maintenanceRate)} />
        {rangeView.protocolErrors.length > 0 ? (
          <BrutalDialog
            title="协议错误详情"
            trigger={
              <button type="button" className="text-left w-full h-full cursor-pointer hover:opacity-80 transition-opacity">
                <Metric 
                  label="范围协议错误" 
                  value={`${rangeView.protocolErrors.length}`} 
                  danger={true} 
                />
              </button>
            }
          >
            {(close) => (
              <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto brutal-scrollbar pr-2">
                <div className="flex flex-col gap-4">
                  {rangeView.protocolErrors.map((error, idx) => (
                    <div className="border-l-4 border-danger pl-4 py-2 bg-danger/5" key={`${error.type}-${error.startAt}-${error.endAt}-${idx}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <strong className="font-mono text-base text-danger">{protocolErrorLabel(error.type)}</strong>
                        <span className="font-mono text-sm text-ink-light bg-paper px-1 border border-ink">{error.date}</span>
                      </div>
                      <p className="font-serif text-base mb-2 font-bold leading-relaxed">{error.message}</p>
                      <span className="font-mono text-sm text-ink-light bg-highlight px-1 border border-ink inline-block">{timeRange(error.startAt, error.endAt, rangeView.timezone)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end pt-4 border-t-2 border-ink">
                  <button type="button" onClick={close} className="btn-brutal px-8 py-2">关闭 (CLOSE)</button>
                </div>
              </div>
            )}
          </BrutalDialog>
        ) : null}
        <Metric 
          label="活跃线程" 
          value={`${urgentThreads.length}`} 
          danger={urgentThreads.length > 0} 
        />
      </section>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left Column: Overview & Facts */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <section className="panel-brutal">
            <div className="flex justify-between items-start mb-8 border-b-2 border-ink pb-4">
              <div>
                <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Overview</p>
                <h2 className="font-serif text-3xl font-bold">时间镜像</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-12">
              
              {rangeView.startDate === rangeView.endDate ? (
                <TimeTape timeline={rangeView.timeline} timezone={rangeView.timezone} startDate={rangeView.startAt} endDate={rangeView.endAt} visitorMode={visitorMode} />
              ) : !isUltraMacro ? (
                <MacroDistribution timeline={rangeView.timeline} timezone={rangeView.timezone} startDate={rangeView.startDate} endDate={rangeView.endDate} />
              ) : null}

              
              <div className={!isUltraMacro ? "border-t-2 border-dashed border-ink/20 pt-8" : ""}>
                <h3 className="font-mono font-bold text-sm bg-ink text-white inline-block px-2 py-1 mb-4 uppercase">{factLayerTitle}</h3>
                <FactDistribution factTotals={rangeView.factTotals} planTotals={rangeView.planTotals} shiftComposition={rangeView.shiftComposition} factLayerTitle={factLayerTitle} />
              </div>
            </div>
          </section>

          {(rangeView.startDate === rangeView.endDate) && !visitorMode && (
            <section className="panel-brutal">
              <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4">
                <div>
                  <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">
                    Timeline
                  </p>
                  <h2 className="font-serif text-3xl font-bold">
                    {factLayerTitle}
                    <span className="text-xl text-ink-light font-mono ml-2">({rangeView.label})</span>
                  </h2>
                </div>
              </div>
              <Timeline timeline={rangeView.timeline} timezone={rangeView.timezone} factLayerTitle={factLayerTitle} />
            </section>
          )}
        </div>

        {/* Right Column: Sync & Protocol Errors */}
        <div className="lg:col-span-4 relative min-h-[760px]">
          <div className="lg:absolute lg:inset-0 flex flex-col gap-8">
            <SyncPanel latestSyncRun={latestSyncRun} timezone={rangeView.timezone} readOnly={visitorMode} />
            
            {/* Notes Section */}
            {!isUltraMacro && <JournalPanel rangeView={rangeView} visitorMode={visitorMode} />}
          </div>
        </div>
      </div>

      {/* Threads Section */}
      <ThreadPanel 
        threadGroups={threadGroups} 
        view={view} 
        rangeView={rangeView} 
        visitorMode={visitorMode} 
      />

    </main>
  );
}

// Sub-components

function RangeLink({ active, href, label, title }: { active: boolean; href: string; label: string; title?: string }) {
  return (
    <Link 
      className={`font-mono text-sm px-3 py-1.5 border-2 border-ink transition-colors ${
        active ? "bg-ink text-highlight font-bold" : "bg-white text-ink hover:bg-highlight"
      }`} 
      href={href}
      title={title}
    >
      {label}
    </Link>
  );
}
