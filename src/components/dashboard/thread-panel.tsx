"use client";

import { useMemo, useState } from "react";
import { BrutalDialog } from "../brutal-dialog";
import { ActionForm } from "../action-form";
import { SubmitButton } from "../submit-button";
import { Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { saveThreadDeclarationAction, deleteThreadDeclarationAction } from "../../app/dashboard/actions";
import { DashboardData } from "../../server/services/dashboard-service";
import { formatDuration, formatGeneratedAt, percent, statusLabel, timeRange, kindLabel } from "../view-formatters";
import { MetricItem } from "./metric-card";
import { semanticTagColorClass } from "../semantic-colors";
import { compactActivityTitle } from "./activity-title";
import { groupThreads, threadSourceLabel } from "./utils";

type ThreadActivityFilter = "active" | "inactive" | "all";

export function ThreadPanel({
  view,
  rangeView,
  visitorMode = false
}: {
  view: DashboardData["view"];
  rangeView: DashboardData["rangeView"];
  visitorMode?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState<ThreadActivityFilter>("active");
  const normalizedQuery = query.trim().toLowerCase();
  const activityFilteredThreads = useMemo(() => {
    if (activityFilter === "all") return combineThreadRowsForAll(view.threads);
    return view.threads.filter((thread: any) => (thread.activityState ?? "active") === activityFilter);
  }, [activityFilter, view.threads]);
  const activityThreadGroups = useMemo(
    () => groupThreads(activityFilteredThreads as DashboardData["view"]["threads"]),
    [activityFilteredThreads]
  );
  const filteredThreadGroups = useMemo(() => {
    if (!normalizedQuery) return activityThreadGroups;

    return activityThreadGroups
      .map((group) => {
        const groupMatches = String(group.group).toLowerCase().includes(normalizedQuery);
        const items = groupMatches
          ? group.items
          : group.items.filter((thread: any) =>
              [thread.group, thread.item, thread.key]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedQuery))
            );

        return items.length > 0 ? { ...group, items } : null;
      })
      .filter(Boolean);
  }, [activityThreadGroups, normalizedQuery]);
  const activeItemCount = view.threads.filter((thread: any) => (thread.activityState ?? "active") === "active").length;
  const inactiveItemCount = view.threads.filter((thread: any) => thread.activityState === "inactive").length;
  const activeGroupCount = groupThreads(
    view.threads.filter((thread: any) => (thread.activityState ?? "active") === "active") as DashboardData["view"]["threads"]
  ).length;
  const inactiveGroupCount = groupThreads(
    view.threads.filter((thread: any) => thread.activityState === "inactive") as DashboardData["view"]["threads"]
  ).length;
  const allGroupCount = groupThreads(view.threads).length;
  const currentFilterLabel =
    activityFilter === "active"
      ? `${activeGroupCount} GROUPS / ${activeItemCount} ITEMS`
      : activityFilter === "inactive"
        ? `${inactiveGroupCount} GROUPS / ${inactiveItemCount} ITEMS`
        : `${allGroupCount} GROUPS / ${view.threads.length} ITEMS`;

  if (visitorMode) return null;

  return (
    <section className="mb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-4 border-ink pb-2">
        <div>
          <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Threads</p>
          <h2 className="font-serif text-4xl md:text-5xl font-black uppercase">线程追踪</h2>
        </div>
        <div className="mt-4 flex max-w-full items-stretch md:mt-0">
          <div className="inline-flex border border-ledger bg-ledger">
            <ThreadViewIconButton
              active={activityFilter === "active"}
              title="Active items"
              onClick={() => setActivityFilter("active")}
              icon="active"
            />
            <ThreadViewIconButton
              active={activityFilter === "inactive"}
              title="Inactive items"
              onClick={() => setActivityFilter("inactive")}
              icon="inactive"
            />
            <ThreadViewIconButton
              active={activityFilter === "all"}
              title="All items"
              onClick={() => setActivityFilter("all")}
              icon="all"
            />
          </div>
          <span className="bg-ledger px-2 py-1 font-mono text-sm text-ledger-foreground">
            {currentFilterLabel}
          </span>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <BrutalDialog 
          title="New Plan"
          trigger={
            <button type="button" className="btn-brutal inline-flex items-center justify-center gap-2 h-[42px] whitespace-nowrap px-3 sm:px-4">
              <span className="text-lg leading-none font-bold">+</span> NEW PLAN
            </button>
          }
        >
          {(close) => (
            <ActionForm className="flex flex-col gap-4" action={saveThreadDeclarationAction} resetOnSuccess onSuccess={close}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Group</span>
                  <input className="input-brutal w-full" name="group" placeholder="Group Name" required />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Item</span>
                  <input className="input-brutal w-full" name="item" placeholder="Item Name" required />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Target</span>
                  <input className="input-brutal w-full" name="expectedMinutes" inputMode="text" placeholder="120 / 2h30m" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Deadline</span>
                  <input className="input-brutal w-full" name="deadline" type="date" />
                </label>
              </div>
              <div className="flex justify-end mt-4">
                <SubmitButton className="btn-brutal h-[40px] whitespace-nowrap" pendingText="CREATING...">创建线程</SubmitButton>
              </div>
            </ActionForm>
          )}
        </BrutalDialog>

        <label className="relative block min-w-0 flex-1 md:max-w-md">
          <span className="sr-only">Search threads</span>
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            className="input-brutal h-[42px] w-full pl-9 font-mono text-sm shadow-brutal transition-[box-shadow,transform] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[1px_1px_0_0_rgb(var(--color-shadow))]"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH GROUP / ITEM"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredThreadGroups.map((group: any) => {
          const dangerBorder = ['expired', 'stale', 'imbalanced'].includes(group.status);
          const warnBorder = ['tightPace', 'needsScheduling'].includes(group.status);
          const showGroupStatus = group.status !== "untracked";
          
          return (
            <details 
              suppressHydrationWarning
              className={`group panel-brutal !p-0 overflow-hidden ${
                dangerBorder ? 'border-danger shadow-[8px_8px_0_0_rgb(var(--color-danger))]' :
                warnBorder ? 'border-highlight shadow-[8px_8px_0_0_rgb(var(--color-highlight))]' : ''
              }`}
              key={group.key}
            >
              <summary className="bg-ledger text-ledger-foreground p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-ink-light transition-colors select-none">
                <div className="flex items-center gap-4">
                  <span className="text-ledger-foreground opacity-50 group-open:rotate-90 transition-transform w-4 inline-block text-center font-mono">▶</span>
                  <h3 className="font-serif text-2xl font-bold">{group.group}</h3>
                  {showGroupStatus ? (
                    <span className={`font-mono text-xs px-2 py-1 uppercase font-bold ${
                      dangerBorder ? 'bg-danger text-ink-fixed' :
                      warnBorder ? 'bg-highlight text-ink-fixed' : 'bg-paper/20'
                    }`}>
                      {statusLabel(group.status)}
                    </span>
                  ) : null}
                </div>
                <span className="font-mono text-sm opacity-80">{group.items.length} Items</span>
              </summary>

              <div className="grid grid-cols-1 lg:grid-cols-12 border-t-2 border-ink">
                <div className="lg:col-span-4 p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-ink bg-paper/50 flex flex-col justify-between">
                   <dl className="grid grid-cols-2 gap-x-4 gap-y-6 mb-6">
                      <MetricItem compact label="预计投入" value={formatDuration(group.expectedMinutes)} />
                      <MetricItem compact label="已兑现" value={formatDuration(group.fulfilledMinutes)} />
                      <MetricItem compact label="未来计划" value={formatDuration(group.futureMinutes)} />
                      <MetricItem compact label="未计划缺口" value={formatDuration(group.unscheduledGapMinutes)} />
                      <MetricItem compact label="事实缺口" value={formatDuration(group.factGapMinutes)} />
                      <MetricItem compact label="Deadline" value={group.deadline ?? "---"} />
                      <MetricItem compact label="计划覆盖率" value={group.planCoverageRate === null ? "---" : percent(group.planCoverageRate)} />
                      <MetricItem compact label="每日需安排" value={formatDuration(group.dailyRequiredMinutes ? Math.round(group.dailyRequiredMinutes) : null)} />
                   </dl>
                   
                   <BrutalDialog
                     title={`Add Item to ${group.group}`}
                     trigger={
                       <button type="button" className="font-mono text-xs font-bold uppercase mb-1 cursor-pointer hover:text-highlight inline-flex items-center gap-1 select-none w-full text-left">
                         <span className="text-lg leading-none">+</span> Add Item
                       </button>
                     }
                   >
                     {(close) => (
                       <ActionForm className="flex flex-col gap-4" action={saveThreadDeclarationAction} resetOnSuccess onSuccess={close}>
                          <input type="hidden" name="group" value={group.group} />
                          <label className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-bold uppercase">Item</span>
                            <input className="input-brutal w-full" name="item" placeholder="Item Name" required />
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <label className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-bold uppercase">Target</span>
                              <input className="input-brutal w-full" name="expectedMinutes" inputMode="text" placeholder="120 / 2h30m" />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-bold uppercase">Deadline</span>
                              <input className="input-brutal w-full" name="deadline" type="date" />
                            </label>
                          </div>
                          <div className="flex justify-end mt-4">
                            <SubmitButton className="btn-brutal text-sm py-2" pendingText="ADDING...">添加 Item</SubmitButton>
                          </div>
                        </ActionForm>
                     )}
                   </BrutalDialog>
                </div>

                <div className="lg:col-span-8 p-0 bg-surface">
                  {group.items.map((thread: any, idx: number) => (
                    <section className={`p-6 ${idx !== group.items.length - 1 ? 'border-b-2 border-ink' : ''}`} key={thread.key}>
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        <div className="min-w-0">
                          <h4 className="font-serif text-xl font-bold mb-1">{thread.item}</h4>
                          <span className="font-mono text-xs text-ink-light inline-flex items-center gap-2">
                            {activityFilter === "all" && (thread.activityState ?? "active") === "active" ? (
                              <>
                                <span className="bg-ink/10 px-1">ACTIVE</span>
                                <span>•</span>
                              </>
                            ) : null}
                            <span className="bg-ink/10 px-1">{statusLabel(thread.status)}</span>
                            <span>•</span>
                            <span>{threadSourceLabel(thread.source)}</span>
                          </span>
                        </div>
                        
                        <div className="min-w-0 max-w-full">
                          <dl className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-sm">
                            <div><dt className="text-ink-light text-xs">Target</dt><dd className="font-bold">{formatDuration(thread.expectedMinutes)}</dd></div>
                            <div><dt className="text-ink-light text-xs">Done</dt><dd className="font-bold">{formatDuration(thread.fulfilledMinutes)}</dd></div>
                            <div><dt className="text-ink-light text-xs">Future</dt><dd className="font-bold">{formatDuration(thread.futureMinutes)}</dd></div>
                            <div><dt className="text-ink-light text-xs">Deadline</dt><dd className="font-bold">{thread.deadline ?? "---"}</dd></div>
                            <div><dt className="text-ink-light text-xs">Daily</dt><dd className="font-bold">{formatDuration(thread.dailyRequiredMinutes)}</dd></div>
                            {threadProgressLabel(thread) ? (
                              <div>
                                <dt className="text-ink-light text-xs">Progress</dt>
                                <dd
                                  className={`font-bold inline-block px-1 ${
                                    threadProgressKind(thread) === "underestimated"
                                      ? "bg-highlight text-ink-fixed"
                                      : ""
                                  }`}
                                >
                                  {threadProgressLabel(thread)}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>
                      </div>

                      <BrutalDialog
                        title={`Edit ${thread.item}`}
                        trigger={
                          <button type="button" className="font-mono text-xs cursor-pointer hover:text-highlight inline-flex items-center gap-1 select-none opacity-60 hover:opacity-100 transition-opacity mb-4 text-left">
                            <span className="text-lg leading-none">+</span> Edit Target/Deadline
                          </button>
                        }
                      >
                        {(close) => (
                          <ActionForm className="flex flex-col gap-4" action={saveThreadDeclarationAction} onSuccess={close}>
                            <input type="hidden" name="group" value={thread.group} />
                            <input type="hidden" name="item" value={thread.item} />
                            
                            <div className="grid grid-cols-2 gap-4">
                              <label className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-bold uppercase">Target</span>
                                <input
                                  className="input-brutal w-full"
                                  name="expectedMinutes"
                                  inputMode="text"
                                  defaultValue={thread.expectedMinutes ?? ""}
                                  placeholder="120 / 2h30m"
                                />
                              </label>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs font-bold uppercase">Deadline</span>
                                  {thread.deadline ? (
                                    <button
                                      type="button"
                                      className="font-mono text-xs font-bold text-danger hover:underline"
                                      onClick={(event) => {
                                        const input = event.currentTarget.form?.elements.namedItem("deadline");
                                        if (input instanceof HTMLInputElement) {
                                          input.value = "";
                                        }
                                      }}
                                    >
                                      清空
                                    </button>
                                  ) : null}
                                </div>
                                <input
                                  className="input-brutal w-full"
                                  name="deadline"
                                  type="date"
                                  defaultValue={thread.deadline ?? ""}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end mt-4">
                              <SubmitButton className="btn-brutal text-sm py-2" pendingText="UPDATING...">更新</SubmitButton>
                            </div>
                          </ActionForm>
                        )}
                      </BrutalDialog>

                      {(thread.history ?? []).length > 0 ? (
                        <details suppressHydrationWarning className="group/history mt-4 pt-4 border-t border-dashed border-ink/30">
                          <summary className="font-mono text-xs text-ink-light mb-2 cursor-pointer hover:text-ink inline-flex items-center gap-1 select-none">
                            <span className="group-open/history:rotate-90 transition-transform">▶</span> RECENT ACTIVITIES
                          </summary>
                          <div className="flex flex-col gap-1 mt-2">
                            {(thread.history ?? []).map((entry: any, entryIndex: number) => {
                              const previous = (thread.history ?? [])[entryIndex - 1];
                              const compactTitle = compactActivityTitle(entry.title);
                              const showDivider = previous && previous.source !== entry.source;
                              const showEpisodeDivider =
                                previous &&
                                !showDivider &&
                                entry.source === "fact" &&
                                isUnnumberedActivityTitle(entry.title);

                              return (
                                <div key={`${entry.source}-${entry.startAt}-${entry.endAt}-${entry.kind}`}>
                                  {showDivider ? <div className="my-2 border-t border-dashed border-ink/40" /> : null}
                                  {showEpisodeDivider ? <div className="my-2 border-t-2 border-ink/70" /> : null}
                                  <div className="flex items-center justify-between font-mono text-xs hover:bg-highlight/20 px-1 -mx-1 rounded">
                                    <span className="text-ink-light w-24 md:w-44 flex flex-col md:flex-row md:gap-1 leading-tight">
                                      <span>{formatGeneratedAt(entry.startAt, rangeView.timezone).slice(0, 10)}</span>
                                      <span>{timeRange(entry.startAt, entry.endAt, rangeView.timezone)}</span>
                                    </span>
                                    <span className={`font-bold w-16 truncate px-1 text-center border ${semanticTagColorClass(entry.kind)}`}>{kindLabel(entry.kind)}</span>
                                    <span className="flex-1 min-w-0 mx-2" title={entry.title}>
                                      <span className="md:hidden">{compactTitle}</span>
                                      <span className="hidden truncate md:block">{entry.title}</span>
                                    </span>
                                    <span className="font-bold">{formatDuration(entry.minutes)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ) : null}

                      {thread.canDelete ? (
                        <ActionForm className="mt-4 flex justify-end" action={deleteThreadDeclarationAction}>
                          <input type="hidden" name="group" value={thread.group} />
                          <input type="hidden" name="item" value={thread.item} />
                          <SubmitButton
                            className="text-xs font-mono text-danger hover:underline flex items-center gap-1"
                            pendingText="DELETING..."
                          >
                            <Cross2Icon /> 删除空 Item
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </section>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function isUnnumberedActivityTitle(title: string): boolean {
  return !/(?:^|\s)\d+$/u.test(title.trim());
}

function combineThreadRowsForAll(threads: DashboardData["view"]["threads"]): DashboardData["view"]["threads"] {
  const byIdentity = new Map<string, DashboardData["view"]["threads"][number]>();

  for (const thread of threads) {
    const key = `${thread.group}\u0000${thread.item}`;
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, { ...thread, history: [...(thread.history ?? [])] });
      continue;
    }

    byIdentity.set(key, combineThreadRows(existing, thread));
  }

  return [...byIdentity.values()];
}

function combineThreadRows(
  a: DashboardData["view"]["threads"][number],
  b: DashboardData["view"]["threads"][number]
): DashboardData["view"]["threads"][number] {
  const activityState =
    (a.activityState ?? "active") === "active" || (b.activityState ?? "active") === "active"
      ? "active"
      : "inactive";
  const factGapMinutes = sumNullable([a.factGapMinutes, b.factGapMinutes]);
  const futureMinutes = a.futureMinutes + b.futureMinutes;

  return {
    ...a,
    key: `${encodeURIComponent(a.group)}/${encodeURIComponent(a.item)}?state=all`,
    activityState,
    source: combineThreadSource(a.source, b.source),
    fulfilledMinutes: a.fulfilledMinutes + b.fulfilledMinutes,
    futureMinutes,
    externalShiftMinutes: a.externalShiftMinutes + b.externalShiftMinutes,
    internalShiftMinutes: a.internalShiftMinutes + b.internalShiftMinutes,
    expectedMinutes: sumNullable([a.expectedMinutes, b.expectedMinutes]),
    deadline: latestDeadline([a.deadline, b.deadline]),
    factGapMinutes,
    unscheduledGapMinutes: sumNullable([a.unscheduledGapMinutes, b.unscheduledGapMinutes]),
    planCoverageRate:
      factGapMinutes === null || factGapMinutes === 0 ? null : futureMinutes / factGapMinutes,
    dailyRequiredMinutes: sumNullable([a.dailyRequiredMinutes, b.dailyRequiredMinutes]),
    status: activityState === "active" ? activeStatus([a, b]) : a.status,
    canDelete: a.canDelete && b.canDelete,
    closed: activityState === "inactive",
    sequences: [...new Set([...a.sequences, ...b.sequences])].sort((left, right) => left - right),
    history: [...(a.history ?? []), ...(b.history ?? [])].sort(
      (left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime()
    )
  };
}

function combineThreadSource(a: string, b: string): DashboardData["view"]["threads"][number]["source"] {
  if (a === b) {
    return a as DashboardData["view"]["threads"][number]["source"];
  }
  return "both";
}

function activeStatus(threads: DashboardData["view"]["threads"]): DashboardData["view"]["threads"][number]["status"] {
  return threads.find((thread) => (thread.activityState ?? "active") === "active")?.status ?? threads[0]!.status;
}

function latestDeadline(deadlines: Array<string | null>): string | null {
  return deadlines
    .filter((deadline): deadline is string => deadline !== null)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function sumNullable(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value !== null);
  return numericValues.length > 0
    ? numericValues.reduce((total, value) => total + value, 0)
    : null;
}

function ThreadViewIconButton({
  active,
  title,
  onClick,
  icon
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  icon: ThreadActivityFilter;
}) {
  return (
    <button
      type="button"
      className={`grid h-[28px] w-[28px] place-items-center border-r border-paper/30 last:border-r-0 transition-colors ${
        active ? "bg-highlight text-ink-fixed" : "bg-ledger text-ledger-foreground hover:bg-highlight hover:text-ink-fixed"
      }`}
      onClick={onClick}
      title={title}
    >
      <ThreadViewGlyph icon={icon} />
    </button>
  );
}

function ThreadViewGlyph({ icon }: { icon: ThreadActivityFilter }) {
  if (icon === "active") {
    return <span aria-hidden className="block h-2.5 w-2.5 bg-current" />;
  }

  if (icon === "inactive") {
    return <span aria-hidden className="block h-2.5 w-2.5 border-2 border-current" />;
  }

  return (
    <span aria-hidden className="grid grid-cols-2 gap-[2px]">
      <span className="block h-[5px] w-[5px] bg-current" />
      <span className="block h-[5px] w-[5px] border border-current" />
      <span className="block h-[5px] w-[5px] border border-current" />
      <span className="block h-[5px] w-[5px] bg-current" />
    </span>
  );
}

function threadProgressLabel(thread: {
  expectedMinutes: number | null;
  fulfilledMinutes: number;
  futureMinutes: number;
  status: string;
}): string | null {
  if (thread.expectedMinutes === null || thread.expectedMinutes <= 0 || thread.status === "fulfilled") {
    return null;
  }

  const ratio = (thread.fulfilledMinutes + thread.futureMinutes) / thread.expectedMinutes;
  return threadProgressKind(thread) === "underestimated"
    ? `低估 ${percent(ratio)}`
    : percent(ratio);
}

function threadProgressKind(thread: {
  expectedMinutes: number | null;
  fulfilledMinutes: number;
  futureMinutes: number;
}): "underestimated" | "completion" {
  return thread.expectedMinutes !== null &&
    thread.fulfilledMinutes + thread.futureMinutes > thread.expectedMinutes
    ? "underestimated"
    : "completion";
}
