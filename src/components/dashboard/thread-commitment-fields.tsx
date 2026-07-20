"use client";

import { useMemo, useState } from "react";

import { formatDuration } from "../view-formatters";

const MS_PER_DAY = 86_400_000;

export function ThreadCommitmentFields({
  defaultStart,
  defaultDeadline = "",
  expectedMinutes = null,
  defaultDailyMinutes = null,
  today
}: {
  defaultStart: string;
  defaultDeadline?: string | null;
  expectedMinutes?: number | null;
  defaultDailyMinutes?: number | null;
  today: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [deadline, setDeadline] = useState(defaultDeadline ?? "");
  const [fixedDaily, setFixedDaily] = useState(defaultDailyMinutes !== null);
  const [amount, setAmount] = useState(String(defaultDailyMinutes ?? expectedMinutes ?? ""));
  const parsedAmount = parseDurationPreview(amount);
  const effectiveStart = start > today ? start : today;
  const days = inclusiveDays(effectiveStart, deadline);
  const derivedDaily = days && parsedAmount !== null ? (fixedDaily ? parsedAmount : parsedAmount / days) : null;
  const derivedTarget = fixedDaily && days && parsedAmount !== null ? parsedAmount * days : parsedAmount;

  return (
    <>
      <div className={`grid grid-cols-1 gap-4 ${derivedDaily !== null ? "sm:grid-cols-2" : ""}`}>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase">{fixedDaily ? "Daily" : "Target"}</span>
          <input
            className="input-brutal w-full"
            name="commitmentAmount"
            inputMode="text"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={fixedDaily ? "30 / 45m" : "120 / 2h30m"}
          />
        </label>
        {derivedDaily !== null ? (
          <div className="flex flex-col justify-end border-b-2 border-ink pb-2 font-mono">
            <span className="text-[10px] font-bold uppercase text-ink-light">{fixedDaily ? "Derived Target" : "Daily"}</span>
            <strong>{formatDuration(Math.round(fixedDaily ? derivedTarget! : derivedDaily))} / {days} DAY</strong>
          </div>
        ) : null}
      </div>

      <input type="hidden" name="expectedMinutes" value={derivedTarget === null ? "" : String(Math.round(derivedTarget))} />
      <input type="hidden" name="dailyMinutes" value={fixedDaily && parsedAmount !== null ? String(Math.round(parsedAmount)) : ""} />

      <label className="inline-flex w-fit items-center gap-2 font-mono text-xs font-bold uppercase">
        <input
          type="checkbox"
          name="fixedDaily"
          value="true"
          checked={fixedDaily}
          onChange={(event) => {
            const nextFixed = event.target.checked;
            if (parsedAmount !== null && days) {
              setAmount(String(Math.round((nextFixed ? parsedAmount / days : parsedAmount * days) * 10) / 10));
            }
            setFixedDaily(nextFixed);
          }}
          disabled={!deadline}
        />
        Fixed Daily
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase">Start</span>
          <input className="input-brutal w-full" name="start" type="date" value={start} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold uppercase">Deadline</span>
            {deadline ? <button type="button" className="font-mono text-xs font-bold text-danger hover:underline" onClick={() => { setDeadline(""); setFixedDaily(false); }}>清空</button> : null}
          </div>
          <input className="input-brutal w-full" name="deadline" type="date" value={deadline} onChange={(event) => {
            setDeadline(event.target.value);
            if (!event.target.value) setFixedDaily(false);
          }} />
        </div>
      </div>
    </>
  );
}

function inclusiveDays(start: string, deadline: string): number | null {
  if (!start || !deadline || start > deadline) return null;
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY) + 1;
}

function parseDurationPreview(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  const match = normalized.match(/^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?$/);
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}
