"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { ActionForm } from "@/components/action-form";
import { BrutalDialog } from "@/components/brutal-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  deletePersonalRuleAction,
  recordPersonalRuleBreakAction,
  savePersonalRuleAction,
  signPersonalRuleAction,
  stopPersonalRuleAction
} from "@/app/dashboard/actions";
import type { DashboardData } from "@/server/services/dashboard-service";

import { todayKey } from "./utils";

type RuleFilter = "active" | "disactive" | "all";
type Rule = DashboardData["personalRules"][number];

export function RulePanel({
  rules,
  timezone,
  visitorMode = false
}: {
  rules: DashboardData["personalRules"];
  timezone: string;
  visitorMode?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RuleFilter>("active");
  const today = todayKey(timezone);
  const normalizedQuery = query.trim().toLowerCase();
  const activeRules = rules.filter((rule) => rule.status === "active");
  const disactiveRules = rules.filter((rule) => rule.status === "archived");
  const visibleRules = useMemo(() => {
    const filteredByStatus =
      filter === "active" ? activeRules : filter === "disactive" ? disactiveRules : rules;
    const sorted = [...filteredByStatus].sort((left, right) => {
      if (left.commitment === right.commitment) return 0;
      return left.commitment === "test" ? -1 : 1;
    });
    if (!normalizedQuery) return sorted;

    return sorted.filter((rule) =>
      [rule.title, rule.content, rule.archiveReason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [activeRules, disactiveRules, filter, normalizedQuery, rules]);
  const filterLabel = `${rules.length} RULES`;

  if (visitorMode) return null;

  return (
    <section className="mb-12">
      <div className="mb-6 flex flex-col items-start justify-between border-b-4 border-ink pb-2 md:flex-row md:items-end">
        <div>
          <p className="mb-1 font-mono text-xs font-bold uppercase tracking-widest">Rules</p>
          <h2 className="font-serif text-4xl font-black uppercase md:text-5xl">规则账本</h2>
        </div>
        <div className="mt-4 flex max-w-full items-stretch md:mt-0">
          <div className="inline-flex border border-ledger bg-ledger">
            <RuleFilterButton
              active={filter === "active"}
              icon="active"
              title="Active rules"
              onClick={() => setFilter("active")}
            />
            <RuleFilterButton
              active={filter === "disactive"}
              icon="disactive"
              title="Disactive rules"
              onClick={() => setFilter("disactive")}
            />
            <RuleFilterButton
              active={filter === "all"}
              icon="all"
              title="All rules"
              onClick={() => setFilter("all")}
            />
          </div>
          <span className="bg-ledger px-2 py-1 font-mono text-sm text-ledger-foreground">
            {filterLabel}
          </span>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <BrutalDialog
          title="New Rule"
          trigger={
            <button type="button" className="btn-brutal inline-flex h-[42px] items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4">
              <span className="text-lg font-bold leading-none">+</span> NEW RULE
            </button>
          }
        >
          {(close) => (
            <ActionForm className="flex flex-col gap-4" action={savePersonalRuleAction} resetOnSuccess onSuccess={close}>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">Rule</span>
                <input className="input-brutal w-full" name="title" placeholder="00:30 前睡觉" required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">Commitment</span>
                <select className="input-brutal w-full" name="commitment" defaultValue="test">
                  <option value="test">TEST</option>
                  <option value="signed">SIGNED</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">Content</span>
                <textarea className="input-brutal min-h-24 w-full" name="content" placeholder="本地时间 00:30 后仍未入睡，算违约。" required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">Start Date</span>
                <input className="input-brutal w-full" name="startDate" type="date" defaultValue={today} required />
              </label>
              <div className="flex justify-end pt-2">
                <SubmitButton className="btn-brutal h-[40px] whitespace-nowrap" pendingText="CREATING...">创建规则</SubmitButton>
              </div>
            </ActionForm>
          )}
        </BrutalDialog>

        <label className="relative block min-w-0 flex-1 md:max-w-md">
          <span className="sr-only">Search rules</span>
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            className="input-brutal h-[42px] w-full pl-9 font-mono text-sm shadow-brutal transition-[box-shadow,transform] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[1px_1px_0_0_rgb(var(--color-shadow))]"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH RULE"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {visibleRules.length > 0 ? (
          visibleRules.map((rule) => <RuleRow key={rule.id} rule={rule} today={today} />)
        ) : (
          <div className="border-2 border-dashed border-ink bg-surface px-5 py-8 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink-light">No Rules Recorded</p>
            <p className="mt-2 font-serif text-2xl font-bold">规则层等待签署</p>
          </div>
        )}
      </div>
    </section>
  );
}

function RuleFilterButton({
  active,
  icon,
  title,
  onClick
}: {
  active: boolean;
  icon: RuleFilter;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-[28px] w-[28px] place-items-center border-r border-paper/30 transition-colors last:border-r-0 ${
        active ? "bg-highlight text-ink-fixed" : "bg-ledger text-ledger-foreground hover:bg-highlight hover:text-ink-fixed"
      }`}
      title={title}
      aria-label={title}
    >
      <RuleFilterGlyph icon={icon} />
    </button>
  );
}

function RuleFilterGlyph({ icon }: { icon: RuleFilter }) {
  if (icon === "active") {
    return <span aria-hidden className="block h-2.5 w-2.5 bg-current" />;
  }

  if (icon === "disactive") {
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

function RuleRow({ rule, today }: { rule: Rule; today: string }) {
  const isBrokenToday = rule.runStatus === "brokenToday";
  const isArchived = rule.runStatus === "archived";

  return (
    <details
      suppressHydrationWarning
      className={`group border-2 bg-surface ${
        isBrokenToday ? "border-danger shadow-[4px_4px_0_0_rgb(var(--color-danger))]" : "border-ink shadow-brutal"
      }`}
    >
      <summary className="grid cursor-pointer grid-cols-1 gap-3 px-3 py-2 transition-colors hover:bg-highlight/20 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-block w-4 shrink-0 text-center font-mono text-xs transition-transform group-open:rotate-90">▶</span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate font-serif text-lg font-bold">{rule.title}</h3>
              <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
                <CommitmentBadge commitment={rule.commitment} />
                <RuleStatusBadge status={rule.runStatus} />
              </div>
            </div>
            <p className="truncate font-mono text-xs text-ink-light">{rule.content}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 font-mono text-xs md:min-w-[330px]">
          <CompactMetric label="Run" value={String(rule.currentRunDays)} danger={isBrokenToday} align="right" emphasis />
          <CompactMetric label="Best" value={String(rule.bestRunDays)} align="right" emphasis />
          <CompactMetric label="Breaks" value={String(rule.breakCount)} align="right" emphasis />
        </dl>
      </summary>

      <div className="border-t-2 border-ink bg-paper/60 px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="min-w-0">
            <dl className="grid grid-cols-1 gap-3 font-mono text-xs md:grid-cols-2">
              <RuleText label="Content" value={rule.content} className="md:col-span-2" />
              <CompactMetric label="Start" value={rule.startDate} />
              <CompactMetric label="Current Start" value={rule.currentRunStartDate ?? "---"} />
              <CompactMetric label="Last Break" value={rule.lastBreak?.brokenDate ?? "---"} />
              <CompactMetric label="Archived" value={rule.archivedAt?.slice(0, 10) ?? "---"} />
            </dl>

            <details suppressHydrationWarning className="group/history mt-4 border-t border-dashed border-ink/40 pt-3">
              <summary className="inline-flex cursor-pointer select-none items-center gap-1 font-mono text-xs text-ink-light hover:text-ink">
                <span className="transition-transform group-open/history:rotate-90">▶</span> BROKEN HISTORY
              </summary>
              <div className="mt-3 flex flex-col gap-1">
                {rule.breaks.length > 0 ? (
                  rule.breaks.map((ruleBreak) => (
                    <div
                      className="grid grid-cols-1 gap-2 border border-ink/30 bg-surface px-2 py-2 font-mono text-xs md:grid-cols-[90px_minmax(0,1fr)_minmax(0,2fr)]"
                      key={ruleBreak.id}
                    >
                      <strong>{ruleBreak.brokenDate}</strong>
                      <span className="truncate">{ruleBreak.scene}</span>
                      <span className="truncate text-ink-light">{ruleBreak.type === "test_break" ? "TEST BREAK" : "RULE BREAK"} · {ruleBreak.reason}</span>
                    </div>
                  ))
                ) : (
                  <p className="font-mono text-xs text-ink-light">NO BREAK RECORDED</p>
                )}
              </div>
            </details>
          </div>

          <div className="flex flex-col gap-4 border-t-2 border-ink pt-4 lg:border-l-2 lg:border-t-0 lg:pl-4 lg:pt-0">
            {rule.status === "active" && rule.commitment === "test" ? (
              <ActionForm action={signPersonalRuleAction} confirmMessage="正式签署这条规则？当前 run 和违约历史将继续保留。">
                <input type="hidden" name="ruleId" value={rule.id} />
                <SubmitButton className="btn-brutal h-[38px] w-full" pendingText="SIGNING...">SIGN RULE</SubmitButton>
              </ActionForm>
            ) : null}
            {rule.status === "active" ? (
              <ActionForm className="flex flex-col gap-3" action={recordPersonalRuleBreakAction} resetOnSuccess>
                <input type="hidden" name="ruleId" value={rule.id} />
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Broken Date</span>
                  <input className="input-brutal w-full" name="brokenDate" type="date" defaultValue={today} required />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Scene</span>
                  <input className="input-brutal w-full" name="scene" placeholder="违约现场" required />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Reason</span>
                  <textarea className="input-brutal min-h-20 w-full" name="reason" placeholder="原因，不改变判定。" required />
                </label>
                <SubmitButton className="btn-brutal bg-danger text-ink-fixed h-[38px]" pendingText="RECORDING...">RECORD BREAK</SubmitButton>
              </ActionForm>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="border border-ink bg-surface p-3 font-mono text-xs text-ink-light">
                  DISACTIVE RULE. HISTORY IS LOCKED.
                </p>
                {rule.archiveReason ? (
                  <div className="border border-ink bg-surface p-3 font-mono text-xs">
                    <p className="text-[10px] font-bold uppercase text-ink-light">Stop Reason</p>
                    <p className="mt-1 whitespace-pre-wrap break-words font-bold leading-snug">{rule.archiveReason}</p>
                  </div>
                ) : null}
                <ActionForm
                  className="pt-1"
                  action={deletePersonalRuleAction}
                  confirmMessage="Delete this archived rule and all break history?"
                >
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <SubmitButton className="font-mono text-xs font-bold uppercase text-danger hover:text-ink" pendingText="DELETING...">
                    Delete Rule
                  </SubmitButton>
                </ActionForm>
              </div>
            )}

            {rule.status === "active" ? (
              <ActionForm
                className="flex flex-col gap-2 border-t border-dashed border-ink/40 pt-3"
                action={stopPersonalRuleAction}
                confirmMessage="停用这条规则？run 和违约历史将保留，但不能再记录违约。"
              >
                <input type="hidden" name="ruleId" value={rule.id} />
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-bold uppercase">Stop Reason</span>
                  <input className="input-brutal w-full" name="archiveReason" placeholder="停用原因" />
                </label>
                <SubmitButton className="font-mono text-xs font-bold uppercase text-ink-light hover:text-danger" pendingText="STOPPING...">
                  Stop Rule
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}

function CommitmentBadge({ commitment }: { commitment: Rule["commitment"] }) {
  return (
    <span className="inline-block w-[58px] bg-ledger px-2 py-0.5 text-center font-mono text-[10px] font-black uppercase text-ledger-foreground">
      {commitment}
    </span>
  );
}

function RuleStatusBadge({ status }: { status: Rule["runStatus"] }) {
  const labels: Record<Rule["runStatus"], string> = {
    active: "ACTIVE",
    brokenToday: "BROKEN TODAY",
    resetPending: "RESET PENDING",
    archived: "DISACTIVE"
  };
  const className =
    status === "brokenToday"
      ? "bg-danger text-ink-fixed"
      : "bg-ledger text-ledger-foreground";

  return <span className={`px-2 py-0.5 font-mono text-[10px] font-black uppercase ${className}`}>{labels[status]}</span>;
}

function CompactMetric({
  label,
  value,
  danger = false,
  align = "left",
  emphasis = false
}: {
  label: string;
  value: string;
  danger?: boolean;
  align?: "left" | "right";
  emphasis?: boolean;
}) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <dt className="truncate text-[10px] font-bold uppercase text-ink-light">{label}</dt>
      <dd className={`truncate ${emphasis ? "text-xl font-normal leading-none md:text-2xl" : "font-bold"} ${danger ? "text-danger" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function RuleText({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] font-bold uppercase text-ink-light">{label}</dt>
      <dd className="whitespace-pre-wrap break-words font-bold leading-snug">{value}</dd>
    </div>
  );
}
