"use client";

import { useMemo, useState } from "react";

import { inclusiveCalendarDays } from "@/server/domain/time";
import { parseDurationText } from "@/server/domain/duration";
import { formatDuration } from "../view-formatters";

export function ThreadCommitmentFields({
  defaultStart,
  defaultDeadline = "",
  expectedMinutes = null,
  defaultSteadyDaily = false,
  today
}: {
  defaultStart: string;
  defaultDeadline?: string | null;
  expectedMinutes?: number | null;
  defaultSteadyDaily?: boolean;
  today: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [deadline, setDeadline] = useState(defaultDeadline ?? "");
  const [steadyDaily, setSteadyDaily] = useState(defaultSteadyDaily);
  const [amount, setAmount] = useState(String(expectedMinutes ?? ""));
  const parsedAmount = parseDurationPreview(amount);
  const effectiveStart = start > today ? start : today;
  const days =
    effectiveStart && deadline && effectiveStart <= deadline
      ? inclusiveCalendarDays(effectiveStart, deadline)
      : null;
  const derivedDaily = days && parsedAmount !== null ? parsedAmount / days : null;

  return (
    <>
      <div className={`grid grid-cols-1 gap-4 ${derivedDaily !== null ? "sm:grid-cols-2" : ""}`}>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase">Target</span>
          <input
            className="input-brutal w-full"
            name="commitmentAmount"
            inputMode="text"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="120 / 2h30m"
          />
        </label>
        {derivedDaily !== null ? (
          <div className="flex flex-col justify-end border-b-2 border-ink pb-2 font-mono">
            <span className="text-[10px] font-bold uppercase text-ink-light">Daily</span>
            <strong>{formatDuration(Math.ceil(derivedDaily))} / {days} DAY</strong>
          </div>
        ) : null}
      </div>

      <input type="hidden" name="expectedMinutes" value={parsedAmount === null ? "" : String(Math.round(parsedAmount))} />

      <label className="inline-flex w-fit items-center gap-2 font-mono text-xs font-bold uppercase">
        <input
          type="checkbox"
          name="steadyDaily"
          value="true"
          checked={steadyDaily}
          onChange={(event) => setSteadyDaily(event.target.checked)}
          disabled={!deadline}
        />
        Steady Daily
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase">Start</span>
          <input className="input-brutal w-full" name="start" type="date" value={start} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold uppercase">Deadline</span>
            {deadline ? <button type="button" className="font-mono text-xs font-bold text-danger hover:underline" onClick={() => { setDeadline(""); setSteadyDaily(false); }}>清空</button> : null}
          </div>
          <input className="input-brutal w-full" name="deadline" type="date" value={deadline} onChange={(event) => {
            setDeadline(event.target.value);
            if (!event.target.value) setSteadyDaily(false);
          }} />
        </div>
      </div>
    </>
  );
}

function parseDurationPreview(value: string): number | null {
  return parseDurationText(value, { allowDecimal: true });
}
