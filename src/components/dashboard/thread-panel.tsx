import { BrutalDialog } from "../brutal-dialog";
import { ActionForm } from "../action-form";
import { SubmitButton } from "../submit-button";
import { Cross2Icon } from "@radix-ui/react-icons";
import { saveThreadDeclarationAction, deleteThreadDeclarationAction } from "../../app/dashboard/actions";
import { DashboardData } from "../../server/services/dashboard-service";
import { formatDuration, formatGeneratedAt, percent, statusLabel, timeRange, kindLabel } from "../view-formatters";
import { MetricItem } from "./metric-card";
import { semanticColorClass } from "../semantic-colors";
import { threadSourceLabel } from "./utils";

export function ThreadPanel({
  threadGroups,
  view,
  rangeView,
  visitorMode = false
}: {
  threadGroups: any[]; // Using any[] to avoid circular dependency complex types, we can infer from usage
  view: DashboardData["view"];
  rangeView: DashboardData["rangeView"];
  visitorMode?: boolean;
}) {
  if (visitorMode) return null;

  return (
    <section className="mb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-4 border-ink pb-2">
        <div>
          <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Plans</p>
          <h2 className="font-serif text-4xl md:text-5xl font-black uppercase">线程追踪</h2>
        </div>
        <span className="font-mono text-sm bg-ink text-white px-2 py-1 mt-4 md:mt-0">
          {threadGroups.length} GROUPS / {view.threads.length} ITEMS
        </span>
      </div>

      <BrutalDialog 
        title="New Plan"
        trigger={
          <button type="button" className="btn-brutal inline-flex items-center gap-2 mb-8">
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

      <div className="grid grid-cols-1 gap-6">
        {threadGroups.map((group) => {
          const dangerBorder = ['expired', 'imbalanced'].includes(group.status);
          const warnBorder = ['tightPace', 'needsScheduling'].includes(group.status);
          
          return (
            <details 
              className={`group panel-brutal !p-0 overflow-hidden ${
                dangerBorder ? 'border-danger shadow-[8px_8px_0_0_#ff3333]' : 
                warnBorder ? 'border-highlight shadow-[8px_8px_0_0_#d5ff00]' : ''
              }`} 
              key={group.key}
            >
              <summary className="bg-ink text-white p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-ink-light transition-colors select-none">
                <div className="flex items-center gap-4">
                  <span className="text-white opacity-50 group-open:rotate-90 transition-transform w-4 inline-block text-center font-mono">▶</span>
                  <h3 className="font-serif text-2xl font-bold">{group.group}</h3>
                  <span className={`font-mono text-xs px-2 py-1 uppercase font-bold ${
                    dangerBorder ? 'bg-danger text-white' : 
                    warnBorder ? 'bg-highlight text-ink' : 'bg-white/20'
                  }`}>
                    {statusLabel(group.status)}
                  </span>
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

                <div className="lg:col-span-8 p-0 bg-white">
                  {group.items.map((thread: any, idx: number) => (
                    <section className={`p-6 ${idx !== group.items.length - 1 ? 'border-b-2 border-ink' : ''}`} key={thread.key}>
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        <div>
                          <h4 className="font-serif text-xl font-bold mb-1">{thread.item}</h4>
                          <span className="font-mono text-xs text-ink-light inline-flex items-center gap-2">
                            <span className="bg-ink/10 px-1">{statusLabel(thread.status)}</span>
                            <span>•</span>
                            <span>{threadSourceLabel(thread.source)}</span>
                          </span>
                        </div>
                        
                        <div className="flex gap-4">
                          <dl className="flex gap-4 font-mono text-sm">
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
                                      ? "bg-highlight text-ink"
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
                              <label className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-bold uppercase">Deadline</span>
                                <input
                                  className="input-brutal w-full"
                                  name="deadline"
                                  type="date"
                                  defaultValue={thread.deadline ?? ""}
                                />
                              </label>
                            </div>
                            <div className="flex justify-end mt-4">
                              <SubmitButton className="btn-brutal text-sm py-2" pendingText="UPDATING...">更新</SubmitButton>
                            </div>
                          </ActionForm>
                        )}
                      </BrutalDialog>

                      {(thread.history ?? []).length > 0 ? (
                        <details className="group/history mt-4 pt-4 border-t border-dashed border-ink/30">
                          <summary className="font-mono text-xs text-ink-light mb-2 cursor-pointer hover:text-ink inline-flex items-center gap-1 select-none">
                            <span className="group-open/history:rotate-90 transition-transform">▶</span> RECENT ACTIVITIES
                          </summary>
                          <div className="flex flex-col gap-1 mt-2">
                            {(thread.history ?? []).map((entry: any, entryIndex: number) => {
                              const previous = (thread.history ?? [])[entryIndex - 1];
                              const showDivider = previous && previous.source !== entry.source;

                              return (
                                <div key={`${entry.source}-${entry.startAt}-${entry.endAt}-${entry.kind}`}>
                                  {showDivider ? <div className="my-2 border-t border-dashed border-ink/40" /> : null}
                                  <div className="flex items-center justify-between font-mono text-xs hover:bg-highlight/20 px-1 -mx-1 rounded">
                                    <span className="text-ink-light w-24 md:w-44 flex flex-col md:flex-row md:gap-1 leading-tight">
                                      <span>{formatGeneratedAt(entry.startAt, rangeView.timezone).slice(0, 10)}</span>
                                      <span>{timeRange(entry.startAt, entry.endAt, rangeView.timezone)}</span>
                                    </span>
                                    <span className={`font-bold w-16 truncate px-1 text-center border border-ink ${semanticColorClass(entry.kind)}`}>{kindLabel(entry.kind)}</span>
                                    <span className="flex-1 truncate mx-2">{entry.title}</span>
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
                          <button className="text-xs font-mono text-danger hover:underline flex items-center gap-1" type="submit">
                            <Cross2Icon /> 删除空 Item
                          </button>
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
