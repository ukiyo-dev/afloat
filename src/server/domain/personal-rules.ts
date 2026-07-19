export interface PersonalRuleRecord {
  id: string;
  title: string;
  content: string;
  startDate: string;
  commitment: "test" | "signed";
  signedDate: string | null;
  signedAt: string | null;
  status: "active" | "archived";
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  breaks: PersonalRuleBreakRecord[];
}

export interface PersonalRuleBreakRecord {
  id: string;
  brokenDate: string;
  type: "test_break" | "rule_break";
  scene: string;
  reason: string;
  createdAt: string;
}

export type PersonalRuleRunStatus = "active" | "brokenToday" | "resetPending" | "archived";

export interface PersonalRuleView extends PersonalRuleRecord {
  currentRunDays: number;
  bestRunDays: number;
  breakCount: number;
  currentRunStartDate: string | null;
  lastBreak: PersonalRuleBreakRecord | null;
  runStatus: PersonalRuleRunStatus;
}

export function buildPersonalRuleViews(
  rules: PersonalRuleRecord[],
  today: string
): PersonalRuleView[] {
  return rules.map((rule) => buildPersonalRuleView(rule, today));
}

export function countFulfilledRulesInRange(
  rules: PersonalRuleView[],
  startDate: string,
  endDate: string
): number {
  return rules.filter(
    (rule) =>
      rule.commitment === "signed" &&
      !rule.breaks.some(
        (ruleBreak) =>
          ruleBreak.type === "rule_break" &&
          ruleBreak.brokenDate >= startDate &&
          ruleBreak.brokenDate <= endDate
      )
  ).length;
}

export function buildPersonalRuleView(rule: PersonalRuleRecord, today: string): PersonalRuleView {
  const breaks = [...rule.breaks].sort((a, b) => a.brokenDate.localeCompare(b.brokenDate));
  const lastBreak = breaks.at(-1) ?? null;
  const currentRunStartDate = lastBreak ? addDays(lastBreak.brokenDate, 1) : rule.startDate;
  const runStatus = getRunStatus(rule.status, lastBreak?.brokenDate ?? null, today);
  const currentRunDays =
    runStatus === "archived" || runStatus === "brokenToday" || currentRunStartDate > today
      ? 0
      : elapsedDaysBeforeToday(currentRunStartDate, today);

  return {
    ...rule,
    breaks: [...breaks].reverse(),
    currentRunDays,
    bestRunDays: Math.max(currentRunDays, bestClosedRunDays(rule.startDate, breaks)),
    breakCount: breaks.length,
    currentRunStartDate: runStatus === "brokenToday" ? null : currentRunStartDate,
    lastBreak,
    runStatus
  };
}

function getRunStatus(
  status: PersonalRuleRecord["status"],
  lastBreakDate: string | null,
  today: string
): PersonalRuleRunStatus {
  if (status === "archived") return "archived";
  if (lastBreakDate === today) return "brokenToday";
  if (lastBreakDate && addDays(lastBreakDate, 1) > today) return "resetPending";
  return "active";
}

function bestClosedRunDays(startDate: string, breaks: PersonalRuleBreakRecord[]): number {
  let best = 0;
  let runStart = startDate;

  for (const ruleBreak of breaks) {
    const runEnd = addDays(ruleBreak.brokenDate, -1);
    best = Math.max(best, inclusiveDays(runStart, runEnd));
    runStart = addDays(ruleBreak.brokenDate, 1);
  }

  return best;
}

function inclusiveDays(startDate: string, endDate: string): number {
  if (endDate < startDate) return 0;
  return Math.floor((dateToMs(endDate) - dateToMs(startDate)) / 86_400_000) + 1;
}

function elapsedDaysBeforeToday(startDate: string, today: string): number {
  if (today <= startDate) return 0;
  return Math.floor((dateToMs(today) - dateToMs(startDate)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const next = new Date(dateToMs(date));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function dateToMs(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}
