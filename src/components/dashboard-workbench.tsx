"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, UpdateIcon, CheckIcon, DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";

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
import { RulePanel } from "./dashboard/rule-panel";
import { FactDistribution } from "./dashboard/fact-distribution";
import { Timeline } from "./dashboard/timeline";
import { TimeTape } from "./dashboard/time-tape";

import { MacroDistribution } from "./dashboard/macro-distribution";

import { Metric } from "./dashboard/metric-card";
import { 
  groupThreads,
  protocolErrorLabel, 
  todayKey, 
  shiftedRangeParams,
  syncStatusLabel
} from "./dashboard/utils";
import { projectThreadsForNow } from "./dashboard/thread-now-projection";
import { projectRangeViewForNow } from "./dashboard/range-now-projection";
import { runRecentSyncAction, runRecalibrateAction, recomputeViewsAction } from "@/app/dashboard/actions";
import { SubmitButton } from "./submit-button";

type ThemeMode = "system" | "light" | "dark";
type DashboardTab = "overview" | "threads" | "rules";

const themeModes: ThemeMode[] = ["system", "light", "dark"];
const dashboardTabs: Array<{ key: DashboardTab; label: string }> = [
  { key: "overview", label: "OVERVIEW" },
  { key: "threads", label: "THREADS" },
  { key: "rules", label: "RULES" }
];

function parseDashboardTab(value: string | null): DashboardTab {
  return value === "threads" || value === "rules" ? value : "overview";
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", mode);
}

function ThemeModeButton() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem("afloat-theme-mode");
    const initialMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setMode(initialMode);
    applyThemeMode(initialMode);
  }, []);

  const switchMode = () => {
    const nextMode = themeModes[(themeModes.indexOf(mode) + 1) % themeModes.length];
    setMode(nextMode);
    applyThemeMode(nextMode);
    window.localStorage.setItem("afloat-theme-mode", nextMode);
  };

  const title = `Display: ${mode.toUpperCase()}`;
  const Icon = mode === "light" ? SunIcon : mode === "dark" ? MoonIcon : DesktopIcon;

  return (
    <button
      type="button"
      onClick={switchMode}
      className="inline-flex w-7 shrink-0 items-center justify-center border-l border-highlight/50 bg-ledger text-ledger-foreground hover:bg-highlight hover:text-ink-fixed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight transition-colors"
      title={title}
      aria-label={title}
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}


function getFactLayerTitle(startDate: string, endDate: string, timezone: string) {
  if (startDate !== endDate) {
    return "时间分布 (TEMPORAL DISTRIBUTION)";
  }

  const today = todayKey(timezone);
  
  if (endDate < today) return "往日重现";
  if (startDate > today) return "未雨绸缪";
  return "现在进行";
}

function LocalClock({ value, timezone }: { value: string; timezone: string }) {
  return <>{formatGeneratedAt(value, timezone)}</>;
}

function useMinuteNow(fallback: string) {
  const [now, setNow] = useState(fallback);

  useEffect(() => {
    let intervalTimer: number | undefined;
    const tick = () => setNow(new Date().toISOString());
    tick();
    const timeoutTimer = window.setTimeout(() => {
      tick();
      intervalTimer = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeoutTimer);
      if (intervalTimer !== undefined) {
        window.clearInterval(intervalTimer);
      }
    };
  }, []);

  return now;
}

export function DashboardWorkbench({
  view,
  rangeView,
  latestSyncRun,
  settings,
  personalRules,
  formalRuleCount,
  visitorMode = false,
  isOwner = false,
  basePath = "/dashboard"
}: DashboardData & { visitorMode?: boolean; isOwner?: boolean; basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => parseDashboardTab(searchParams.get("tab")));
  const activeDashboardTab = visitorMode ? "overview" : activeTab;
  const isDefaultView =
    !searchParams.has("range") &&
    !searchParams.has("date") &&
    !searchParams.has("start") &&
    !searchParams.has("end");
  
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

  useEffect(() => {
    setActiveTab(parseDashboardTab(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    const nextHref = buildHref({ tab: tab === "overview" ? null : tab });
    router.replace(nextHref, { scroll: false });
  };

  const runtimeNow = useMinuteNow(view.generatedAt);
  const projectedRangeView = useMemo(
    () => projectRangeViewForNow({ rangeView, view, runtimeNowIso: runtimeNow }),
    [rangeView, runtimeNow, view]
  );
  const internalFulfillmentValue =
    projectedRangeView.internalFulfillmentRate === null
      ? "---"
      : percent(projectedRangeView.internalFulfillmentRate);
  const fulfillmentValue =
    projectedRangeView.fulfillmentRate === null ? undefined : percent(projectedRangeView.fulfillmentRate);
  const fulfillmentSecondaryValue =
    fulfillmentValue && fulfillmentValue !== internalFulfillmentValue ? fulfillmentValue : undefined;
  const projectedThreads = useMemo(
    () =>
      projectThreadsForNow(
        view.threads,
        runtimeNow,
        rangeView.timezone,
        view.generatedAt,
        settings.threadStaleDays
      ),
    [rangeView.timezone, runtimeNow, settings.threadStaleDays, view.generatedAt, view.threads]
  );
  const threadGroups = useMemo(
    () => groupThreads(projectedThreads),
    [projectedThreads]
  );
  const projectedView = useMemo(
    () => ({
      ...view,
      threads: projectedThreads,
      threadGroups
    }),
    [projectedThreads, threadGroups, view]
  );
  const activeThreads = projectedThreads.filter((item) => (item.activityState ?? "active") === "active");
  const redActiveThreadCount = activeThreads.filter((item) =>
    ["expired", "stale", "imbalanced"].includes(item.status)
  ).length;
  const plannedActiveThreadCount = activeThreads.length - redActiveThreadCount;
  const unfulfilledRuleCount = formalRuleCount - projectedRangeView.fulfilledRuleCount;
  
  const factLayerTitle = getFactLayerTitle(
    projectedRangeView.startDate,
    projectedRangeView.endDate,
    projectedRangeView.timezone
  );

  const [startY, startM, startD] = rangeView.startDate.split('-').map(Number);
  const [endY, endM, endD] = rangeView.endDate.split('-').map(Number);
  const startUtc = Date.UTC(startY, startM - 1, startD);
  const endUtc = Date.UTC(endY, endM - 1, endD);
  const daysCount = Math.round((endUtc - startUtc) / 86400000) + 1;
  const isUltraMacro = daysCount > 30;

  return (
    <main className="shell pt-0 md:pt-0">
      <div className="mb-8">
        {!visitorMode ? (
          <nav className="flex flex-wrap items-start justify-end" aria-label="Dashboard tabs">
            {dashboardTabs.map((tab) => (
              <DashboardTabButton
                key={tab.key}
                active={activeDashboardTab === tab.key}
                label={tab.label}
                onSelect={() => selectTab(tab.key)}
              />
            ))}
          </nav>
        ) : null}
      </div>

      <section hidden={activeDashboardTab !== "overview"}>
        <div>
          {/* Header Section */}
          <section className="mb-8 border-b-4 border-ink pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex h-[26px] items-stretch border border-ink bg-ledger shadow-[2px_2px_0_0_rgb(var(--color-highlight))]">
                  {isOwner ? (
                    <Link
                      href={guestModeHref}
                      className="font-mono text-highlight bg-ledger inline-flex items-center px-2 font-bold tracking-widest text-xs hover:bg-highlight hover:text-ink-fixed transition-colors cursor-pointer"
                      title={visitorMode ? "Switch to Owner Mode" : "View as Guest"}
                    >
                      {visitorMode ? "GUEST MODE" : "OWNER MODE"}
                    </Link>
                  ) : (
                    <p className="font-mono text-highlight bg-ledger inline-flex items-center px-2 font-bold tracking-widest text-xs">
                      GUEST MODE
                    </p>
                  )}
                  <ThemeModeButton />
                </div>
                <span className="font-mono text-ink-light text-sm">
                  <LocalClock value={runtimeNow} timezone={projectedRangeView.timezone} />
                </span>
              </div>

              <h1 className="font-serif text-5xl md:text-7xl font-black text-ink leading-none tracking-tighter mb-4">
                浮生
              </h1>
              <p className="font-serif text-xl md:text-2xl font-normal text-ink-light max-w-2xl text-balance">
                <span className="bg-highlight px-1 text-ink-fixed">{projectedRangeView.label}</span> / {projectedRangeView.timezone}
              </p>
            </div>

            <div className="panel-brutal relative overflow-visible !p-4 min-w-[240px] flex flex-col gap-4">
              <div>
                 <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                   {visitorMode ? (
                     <span className="font-mono text-xs font-bold tracking-widest text-ink-light">SYNC</span>
                   ) : (
                     <>
                       <ActionForm action={runRecentSyncAction}>
                         <SubmitButton className="border-0 bg-transparent p-0 font-mono text-xs font-bold tracking-widest text-ink-light shadow-none hover:bg-highlight hover:text-ink-fixed" pendingText="SYNCING..." showMask>
                           SYNC
                         </SubmitButton>
                       </ActionForm>
                       <span className="ml-auto flex items-center gap-3">
                         <ActionForm action={runRecalibrateAction}>
                           <SubmitButton className="border-0 bg-transparent p-0 font-mono text-xs font-bold tracking-widest text-ink-light shadow-none hover:bg-highlight hover:text-ink-fixed" pendingText="FULL..." showMask>
                             FULL
                           </SubmitButton>
                         </ActionForm>
                         <ActionForm action={recomputeViewsAction}>
                           <SubmitButton className="border-0 bg-transparent p-0 font-mono text-xs font-bold tracking-widest text-ink-light shadow-none hover:bg-highlight hover:text-ink-fixed" pendingText="COMPUTING..." showMask>
                             COMPUTE
                           </SubmitButton>
                         </ActionForm>
                       </span>
                     </>
                   )}
                 </div>
                 <div className="flex items-start justify-between gap-2">
                   <div className="min-w-0 flex-1">
                     <span className="mb-1 flex w-full items-center justify-between gap-3 font-mono text-xs font-bold text-ink">
                       <span>UPDATED</span>
                       <span className="text-right">
                         {latestSyncRun ? formatGeneratedAt(latestSyncRun.startedAt, projectedRangeView.timezone) : "NO SYNC"}
                       </span>
                     </span>
                   </div>
                   {latestSyncRun?.status === 'running' ? (
                     <UpdateIcon className="shrink-0 animate-spin text-ink" />
                   ) : null}
                 </div>
                 <span className="font-mono text-xs flex items-center gap-1">
                   {latestSyncRun?.status === 'succeeded' ? <CheckIcon className="text-success" /> : null}
                   {latestSyncRun ? syncStatusLabel(latestSyncRun.status) : "---"}
                 </span>
                 {latestSyncRun?.errorMessage ? (
                   <p className="mt-2 border-l-2 border-danger bg-danger/5 p-2 font-mono text-[10px] text-danger break-words">
                     {latestSyncRun.errorMessage}
                   </p>
                 ) : null}
              </div>

              <div className="ledger-border-t pt-3 mt-1 flex justify-between items-center">
                {visitorMode ? (
                  <Link href="/login" className="font-mono text-sm font-bold hover:underline hover:text-highlight hover:bg-ledger px-2 py-1 transition-colors">
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
          <div className="mb-8 flex flex-col xl:flex-row gap-6 xl:items-end justify-between bg-surface border-2 border-ink p-4 shadow-brutal">
            <nav className="flex flex-col gap-2" aria-label="Dashboard range">
              <div className="flex flex-wrap gap-2">
                <RangeLink
                  active={false}
                  href={buildHref(shiftedRangeParams(rangeView.startDate, rangeView.endDate, -1))}
                  label="Prev"
                  title={daysCount === 1 ? "上一天" : `前移 ${daysCount} 天`}
                />
                <RangeLink
                  active={isDefaultView}
                  href={buildHref({ range: null, date: null, start: null, end: null })}
                  label="Default"
                  title="回到默认视图"
                />
                <RangeLink
                  active={false}
                  href={buildHref(shiftedRangeParams(rangeView.startDate, rangeView.endDate, 1))}
                  label="Next"
                  title={daysCount === 1 ? "下一天" : `后移 ${daysCount} 天`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RangeLink
                  active={!isDefaultView && rangeView.startDate === todayKey(rangeView.timezone) && rangeView.endDate === todayKey(rangeView.timezone)}
                  href={buildHref({ range: "day", date: todayKey(rangeView.timezone), start: null, end: null })}
                  label="今天"
                />
                <RangeLink active={!isDefaultView && rangeView.key === "7d"} href={buildHref({ range: "7d", date: null, start: null, end: null })} label="7 天" />
                <RangeLink active={!isDefaultView && rangeView.key === "14d"} href={buildHref({ range: "14d", date: null, start: null, end: null })} label="14 天" />
                <RangeLink active={!isDefaultView && rangeView.key === "30d"} href={buildHref({ range: "30d", date: null, start: null, end: null })} label="30 天" />
              </div>
            </nav>

            <form className="flex flex-wrap items-end gap-3" action={basePath}>
              <input type="hidden" name="range" value="custom" />
              {activeDashboardTab !== "overview" ? <input type="hidden" name="tab" value={activeDashboardTab} /> : null}
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
            <Metric label="平均计划时间" value={formatDuration(projectedRangeView.averagePlannedMinutes)} />
            <Metric
              label="兑现率"
              value={internalFulfillmentValue}
              secondaryValue={fulfillmentSecondaryValue}
              highlight={projectedRangeView.internalFulfillmentRate !== null && projectedRangeView.internalFulfillmentRate < 0.5}
            />
            <Metric label="维护率" value={percent(projectedRangeView.maintenanceRate)} />
            {activeThreads.length > 0 ? (
              <Metric
                label={redActiveThreadCount > 0 ? "待规划线程" : "已规划线程"}
                value={redActiveThreadCount > 0 ? `${redActiveThreadCount}` : `${plannedActiveThreadCount}/${activeThreads.length}`}
                danger={redActiveThreadCount > 0}
              />
            ) : null}
            {projectedRangeView.protocolErrors.length > 0 ? (
              <BrutalDialog
                title="协议错误详情"
                trigger={
                  <button type="button" className="text-left w-full h-full cursor-pointer hover:opacity-80 transition-opacity">
                    <Metric
                      label="范围协议错误"
                      value={`${projectedRangeView.protocolErrors.length}`}
                      danger={true}
                    />
                  </button>
                }
              >
                {(close) => (
                  <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto brutal-scrollbar pr-2">
                    <div className="flex flex-col gap-4">
                      {projectedRangeView.protocolErrors.map((error, idx) => (
                        <div className="border-l-4 border-danger pl-4 py-2 bg-danger/5" key={`${error.type}-${error.startAt}-${error.endAt}-${idx}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <strong className="font-mono text-base text-danger">{protocolErrorLabel(error.type)}</strong>
                            <span className="font-mono text-sm text-ink-light bg-paper px-1 border border-ink">{error.date}</span>
                          </div>
                          <p className="font-serif text-base mb-2 font-bold leading-relaxed">{error.message}</p>
                          <span className="font-mono text-sm text-ink-fixed bg-highlight px-1 border border-ink inline-block">{timeRange(error.startAt, error.endAt, projectedRangeView.timezone)}</span>
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
            {formalRuleCount > 0 ? (
              <Metric
                label={unfulfilledRuleCount > 0 ? "违约数" : "履约数"}
                value={unfulfilledRuleCount > 0 ? `${unfulfilledRuleCount}` : `${projectedRangeView.fulfilledRuleCount}/${formalRuleCount}`}
                danger={unfulfilledRuleCount > 0}
              />
            ) : null}
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
                    <TimeTape
                      timeline={rangeView.timeline}
                      timezone={rangeView.timezone}
                      startDate={rangeView.startAt}
                      endDate={rangeView.endAt}
                      now={runtimeNow}
                      visitorMode={visitorMode}
                    />
                  ) : !isUltraMacro ? (
                    <MacroDistribution
                      timeline={rangeView.timeline}
                      planTimeline={view.planTimeline}
                      now={runtimeNow}
                      timezone={rangeView.timezone}
                      startDate={rangeView.startDate}
                      endDate={rangeView.endDate}
                    />
                  ) : null}


                  <div className={!isUltraMacro ? "border-t-2 border-dashed border-ink/20 pt-8" : ""}>
                    <h3 className="font-mono font-bold text-sm bg-ledger text-ledger-foreground inline-block px-2 py-1 mb-4 uppercase">{factLayerTitle}</h3>
                    <FactDistribution
                      factTotals={projectedRangeView.factTotals}
                      planTotals={projectedRangeView.planTotals}
                      shiftComposition={projectedRangeView.shiftComposition}
                      activePlanDays={projectedRangeView.observedPlannedDays}
                    />
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
                        <span className="text-xl text-ink-light font-mono ml-2">({projectedRangeView.label})</span>
                      </h2>
                    </div>
                  </div>
                  <Timeline
                    timeline={rangeView.timeline}
                    timezone={rangeView.timezone}
                    startDate={rangeView.startDate}
                  />
                </section>
              )}
            </div>

            {/* Right Column: Sync & Protocol Errors */}
            <div className="lg:col-span-4 relative min-h-[760px]">
              <div className="lg:absolute lg:inset-0 flex flex-col gap-8">
                {/* Notes Section */}
                {!isUltraMacro && <JournalPanel rangeView={projectedRangeView} visitorMode={visitorMode} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section hidden={activeDashboardTab !== "threads"}>
        <ThreadPanel
          view={projectedView}
          rangeView={rangeView}
          visitorMode={visitorMode}
        />
      </section>

      <section hidden={activeDashboardTab !== "rules"}>
        <RulePanel rules={personalRules} timezone={rangeView.timezone} visitorMode={visitorMode} />
      </section>

    </main>
  );
}

// Sub-components

function RangeLink({ active, href, label, title }: { active: boolean; href: string; label: string; title?: string }) {
  return (
    <Link 
      className={`font-mono text-sm px-3 py-1.5 border-2 border-ink transition-colors ${
        active ? "bg-ledger text-highlight font-bold" : "bg-surface text-ink hover:bg-highlight"
      }`} 
      href={href}
      title={title}
    >
      {label}
    </Link>
  );
}

function DashboardTabButton({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`dashboard-bookmark -ml-3 first:ml-0 min-w-[104px] px-3 py-1.5 text-center font-mono text-xs font-black tracking-widest transition-colors ${
        active
          ? "[--bookmark-bg:rgb(var(--color-ledger))] [--bookmark-fg:rgb(var(--color-highlight))]"
          : "[--bookmark-bg:rgb(var(--color-paper))] [--bookmark-fg:rgb(var(--color-ink))] hover:[--bookmark-bg:rgb(var(--color-highlight))] hover:[--bookmark-fg:rgb(var(--color-ink-fixed))]"
      }`}
    >
      {label}
    </button>
  );
}
