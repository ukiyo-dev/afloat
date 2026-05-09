import { intersection, minutesInRange, overlaps } from "@/server/domain/time";
import type { DateRange } from "@/server/domain/types";
import type { PrivateDerivedView } from "@/server/views/derived-view";

export type DashboardRange = "yesterday" | "day" | string; // e.g. "7d", "30d", "90d"
export type DashboardRangeKey = DashboardRange | "custom";

export interface DashboardRangeRequest {
  range?: string;
  date?: string;
  start?: string;
  end?: string;
}

export interface DashboardRangeView {
  key: DashboardRangeKey;
  quickRange: DashboardRange | null;
  label: string;
  timezone: string;
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
  plannedMinutes: number;
  plannedDays: number;
  averagePlannedMinutes: number;
  fulfilledPlanMinutes: number;
  fulfillmentRate: number | null;
  maintenanceRate: number;
  factTotals: Record<string, number>;
  planTotals: Record<string, number>;
  shiftComposition: Record<string, { internal: number; external: number }>;
  protocolErrors: PrivateDerivedView["protocolErrors"];
  timeline: PrivateDerivedView["timeline"];
  notes: PrivateDerivedView["notes"];
}

const rangeLabels: Record<string, string> = {
  yesterday: "昨天",
  day: "今天",
  tomorrow: "明天",
};

export function isDashboardRange(value: unknown): value is DashboardRange {
  if (typeof value !== "string") return false;
  if (value === "yesterday" || value === "day" || value === "tomorrow") return true;
  return /^\d+d$/.test(value);
}

export function resolveDashboardRange(
  requested: unknown,
  fallback: string
): DashboardRange {
  if (isDashboardRange(requested)) {
    return requested;
  }
  if (isDashboardRange(fallback)) {
    return fallback;
  }
  return "yesterday";
}

export function buildDashboardRangeView(input: {
  view: PrivateDerivedView;
  request?: DashboardRangeRequest;
  fallbackRange?: string;
  timezone: string;
  now?: Date;
}): DashboardRangeView {
  const now = input.now ?? new Date(input.view.generatedAt);
  const selection = resolveDashboardRangeSelection({
    request: input.request,
    fallbackRange: input.fallbackRange,
    timezone: input.timezone,
    now
  });
  const range = selection.range;
  const timeline = input.view.timeline.filter((fact) => overlaps(serializedRange(fact), range));
  const planTimeline = (input.view.planTimeline ?? []).filter((plan) =>
    overlaps(serializedRange(plan), range)
  );
  const protocolErrors = input.view.protocolErrors.filter((error) =>
    overlaps(serializedRange(error), range)
  );
  const notes = input.view.notes.filter(
    (note) => note.date >= selection.startDate && note.date <= selection.endDate
  );
  const plannedMinutes = sumClippedMinutes(planTimeline, range);
  const plannedDays = countDaysWithSegments(planTimeline, selection);
  const fulfilledPlanMinutes = sumClippedMinutes(
    timeline.filter(
      (fact) =>
        fact.kind === "idealFulfilled" ||
        fact.kind === "leisureFulfilled" ||
        fact.kind === "restFulfilled"
    ),
    range
  );

  return {
    key: selection.key,
    quickRange: selection.quickRange,
    label: selection.label,
    timezone: input.timezone,
    startDate: selection.startDate,
    endDate: selection.endDate,
    startAt: range.startAt.toISOString(),
    endAt: range.endAt.toISOString(),
    plannedMinutes,
    plannedDays,
    averagePlannedMinutes: plannedDays > 0 ? plannedMinutes / plannedDays : 0,
    fulfilledPlanMinutes,
    fulfillmentRate: plannedMinutes > 0 ? fulfilledPlanMinutes / plannedMinutes : null,
    maintenanceRate: calculateMaintenanceRate(
      input.view.maintenanceTimeline ?? [...planTimeline, ...timeline],
      selection
    ),
    factTotals: totalClippedMinutesByKind(timeline, range),
    planTotals: totalClippedMinutesByKind(planTimeline, range),
    shiftComposition: calculateShiftComposition(timeline, planTimeline, range),
    protocolErrors,
    timeline,
    notes
  };
}

function countDaysWithSegments(
  segments: Array<{ startAt: string; endAt: string }>,
  selection: DashboardRangeSelection
): number {
  let plannedDays = 0;
  let cursor = selection.startDate;

  while (cursor <= selection.endDate) {
    const next = formatLocalDate(addLocalDays(localDateFromKey(cursor), 1));
    const dayRange = {
      startAt: localMidnightToUtc(localDateFromKey(cursor), selection.timezone),
      endAt: localMidnightToUtc(localDateFromKey(next), selection.timezone)
    };

    if (segments.some((segment) => overlaps(serializedRange(segment), dayRange))) {
      plannedDays += 1;
    }

    cursor = next;
  }

  return plannedDays;
}

function calculateMaintenanceRate(
  segments: Array<{ startAt: string; endAt: string }>,
  selection: DashboardRangeSelection
): number {
  let totalDays = 0;
  let maintainedDays = 0;
  let cursor = selection.startDate;

  while (cursor <= selection.endDate) {
    totalDays += 1;
    const next = formatLocalDate(addLocalDays(localDateFromKey(cursor), 1));
    const dayRange = {
      startAt: localMidnightToUtc(localDateFromKey(cursor), selection.timezone),
      endAt: localMidnightToUtc(localDateFromKey(next), selection.timezone)
    };

    if (segments.some((segment) => overlaps(serializedRange(segment), dayRange))) {
      maintainedDays += 1;
    }

    cursor = next;
  }

  return totalDays > 0 ? maintainedDays / totalDays : 0;
}

export function dashboardDateRange(
  range: DashboardRange,
  timezone: string,
  now: Date
): DateRange {
  const today = localDateParts(now, timezone);
  if (range === "yesterday") {
    const yesterday = addLocalDays(today, -1);
    return {
      startAt: localMidnightToUtc(yesterday, timezone),
      endAt: localMidnightToUtc(today, timezone)
    };
  }
  if (range === "day") {
    const endDate = addLocalDays(today, 1);
    return {
      startAt: localMidnightToUtc(today, timezone),
      endAt: localMidnightToUtc(endDate, timezone)
    };
  }
  if (range === "tomorrow") {
    const tomorrow = addLocalDays(today, 1);
    const dayAfter = addLocalDays(today, 2);
    return {
      startAt: localMidnightToUtc(tomorrow, timezone),
      endAt: localMidnightToUtc(dayAfter, timezone)
    };
  }
  
  // xd should end at today (exclusive), meaning they cover up to yesterday
  const days = range.endsWith("d") ? parseInt(range.slice(0, -1), 10) : 7;
  const startDate = addLocalDays(today, -days);

  return {
    startAt: localMidnightToUtc(startDate, timezone),
    endAt: localMidnightToUtc(today, timezone)
  };
}

export function resolveDashboardRangeSelection(input: {
  request?: DashboardRangeRequest;
  fallbackRange?: string;
  timezone: string;
  now: Date;
}): DashboardRangeSelection {
  const requestedRange = input.request?.range;
  const today = dashboardLocalDayKey(input.now, input.timezone);

  if (requestedRange === "custom") {
    const start = parseLocalDateKey(input.request?.start);
    const end = parseLocalDateKey(input.request?.end);

    if (start && end) {
      const [startDate, endDate] = start <= end ? [start, end] : [end, start];
      
      // If start and end are the same day, treat it exactly like a specific "day" query
      if (startDate === endDate) {
        const yesterdayStr = formatLocalDate(addLocalDays(localDateFromKey(today), -1));
        const tomorrowStr = formatLocalDate(addLocalDays(localDateFromKey(today), 1));
        
        let label = startDate;
        if (startDate === today) label = "今天";
        else if (startDate === yesterdayStr) label = "昨天";
        else if (startDate === tomorrowStr) label = "明天";

        return selectionFromDates({
          key: "day",
          quickRange: "day",
          label,
          startDate,
          endDate,
          timezone: input.timezone
        });
      }
      
      return selectionFromDates({
        key: "custom",
        quickRange: null,
        label: `${startDate} 至 ${endDate}`,
        startDate,
        endDate,
        timezone: input.timezone
      });
    }
  }

  if (requestedRange === "day" && input.request?.date) {
    const date = parseLocalDateKey(input.request?.date) ?? today;
    const yesterdayStr = formatLocalDate(addLocalDays(localDateFromKey(today), -1));
    const tomorrowStr = formatLocalDate(addLocalDays(localDateFromKey(today), 1));
    
    let label = date;
    if (date === today) label = "今天";
    else if (date === yesterdayStr) label = "昨天";
    else if (date === tomorrowStr) label = "明天";

    return selectionFromDates({
      key: "day",
      quickRange: "day",
      label,
      startDate: date,
      endDate: date,
      timezone: input.timezone
    });
  }

  const quickRange = resolveDashboardRange(requestedRange, input.fallbackRange ?? "yesterday");
  
  if (quickRange === "yesterday") {
    const yesterday = formatLocalDate(addLocalDays(localDateFromKey(today), -1));
    return selectionFromDates({
      key: "yesterday",
      quickRange: "yesterday",
      label: rangeLabels.yesterday,
      startDate: yesterday,
      endDate: yesterday,
      timezone: input.timezone
    });
  }

  if (quickRange === "tomorrow") {
    const tomorrowStr = formatLocalDate(addLocalDays(localDateFromKey(today), 1));
    return selectionFromDates({
      key: "tomorrow",
      quickRange: "tomorrow",
      label: rangeLabels.tomorrow,
      startDate: tomorrowStr,
      endDate: tomorrowStr,
      timezone: input.timezone
    });
  }

  const range = quickRange === "day" ? 1 : quickRange.endsWith("d") ? parseInt(quickRange.slice(0, -1), 10) : 7;
  const todayParts = localDateFromKey(today);
  
  if (quickRange === "day") {
    return selectionFromDates({
      key: quickRange,
      quickRange,
      label: "今天",
      startDate: today,
      endDate: today,
      timezone: input.timezone
    });
  }

  const yesterdayStr = formatLocalDate(addLocalDays(todayParts, -1));
  const startDate = formatLocalDate(addLocalDays(todayParts, -range)); // e.g. for 7d, today - 7 days

  return selectionFromDates({
    key: quickRange,
    quickRange,
    label: `最近 ${range} 天`,
    startDate,
    endDate: yesterdayStr,
    timezone: input.timezone
  });
}

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function totalClippedMinutesByKind(
  segments: Array<{ kind: string; startAt: string; endAt: string }>,
  range: DateRange
): Record<string, number> {
  return segments.reduce<Record<string, number>>((totals, segment) => {
    totals[segment.kind] = (totals[segment.kind] ?? 0) + clippedMinutes(segment, range);
    return totals;
  }, {});
}

function calculateShiftComposition(
  timeline: Array<{ kind: string; startAt: string; endAt: string }>,
  planTimeline: Array<{ kind: string; startAt: string; endAt: string }>,
  range: DateRange
): Record<string, { internal: number; external: number }> {
  const shifts = timeline.filter(f => f.kind === "internalShift" || f.kind === "externalShift");
  
  const composition: Record<string, { internal: number; external: number }> = {
    ideal: { internal: 0, external: 0 },
    leisure: { internal: 0, external: 0 },
    rest: { internal: 0, external: 0 },
    unmapped: { internal: 0, external: 0 } // Shifts that didn't overlap any known plan
  };

  for (const shift of shifts) {
    const shiftMinutes = clippedMinutes(shift, range);
    if (shiftMinutes <= 0) continue;

    // Find if this shift overlaps any plan in the timeline
    const shiftRange = serializedRange(shift);
    const overlappingPlans = planTimeline.filter(plan => overlaps(serializedRange(plan), shiftRange));
    
    // If no overlap, it's an unmapped shift (a shift recorded during blank time)
    if (overlappingPlans.length === 0) {
      if (shift.kind === "internalShift") composition.unmapped.internal += shiftMinutes;
      else composition.unmapped.external += shiftMinutes;
      continue;
    }

    // A single shift might overlap multiple plans (e.g. crossing a boundary between Work and Leisure).
    // We calculate exactly how many minutes it bites out of each specific plan kind.
    let remainingShiftMinutes = shiftMinutes;

    for (const plan of overlappingPlans) {
      // Intersection of the shift AND the plan AND the global view range
      const overlapWithPlan = intersection(serializedRange(plan), shiftRange);
      if (!overlapWithPlan) continue;
      
      const overlapWithinView = intersection(overlapWithPlan, range);
      if (!overlapWithinView) continue;

      const minutesBitten = minutesInRange(overlapWithinView);
      if (minutesBitten <= 0) continue;

      if (composition[plan.kind]) {
        if (shift.kind === "internalShift") {
          composition[plan.kind].internal += minutesBitten;
        } else {
          composition[plan.kind].external += minutesBitten;
        }
        remainingShiftMinutes -= minutesBitten;
      }
    }

    // If there's still remainder (meaning the shift extended past the plan into blank time),
    // allocate it to 'unmapped'
    if (remainingShiftMinutes > 0) {
       if (shift.kind === "internalShift") composition.unmapped.internal += remainingShiftMinutes;
       else composition.unmapped.external += remainingShiftMinutes;
    }
  }

  return composition;
}

function sumClippedMinutes(
  segments: Array<{ startAt: string; endAt: string }>,
  range: DateRange
): number {
  return segments.reduce((total, segment) => total + clippedMinutes(segment, range), 0);
}

function clippedMinutes(segment: { startAt: string; endAt: string }, range: DateRange): number {
  const clipped = intersection(serializedRange(segment), range);
  return clipped ? minutesInRange(clipped) : 0;
}

function serializedRange(segment: { startAt: string; endAt: string }): DateRange {
  return {
    startAt: new Date(segment.startAt),
    endAt: new Date(segment.endAt)
  };
}

export function dashboardLocalDayKey(date: Date, timezone: string): string {
  const parts = localDateParts(date, timezone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function localDateParts(date: Date, timezone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function localMidnightToUtc(date: LocalDate, timezone: string): Date {
  const localAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  let guess = new Date(localAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const offset = timezoneOffsetMs(guess, timezone);
    guess = new Date(localAsUtc - offset);
  }

  return guess;
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const zonedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );

  return zonedAsUtc - date.getTime();
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

interface DashboardRangeSelection {
  key: DashboardRangeKey;
  quickRange: DashboardRange | null;
  label: string;
  startDate: string;
  endDate: string;
  timezone: string;
  range: DateRange;
}

function selectionFromDates(input: {
  key: DashboardRangeKey;
  quickRange: DashboardRange | null;
  label: string;
  startDate: string;
  endDate: string;
  timezone: string;
}): DashboardRangeSelection {
  const endExclusive = formatLocalDate(addLocalDays(localDateFromKey(input.endDate), 1));

  return {
    key: input.key,
    quickRange: input.quickRange,
    label: input.label,
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: input.timezone,
    range: {
      startAt: localMidnightToUtc(localDateFromKey(input.startDate), input.timezone),
      endAt: localMidnightToUtc(localDateFromKey(endExclusive), input.timezone)
    }
  };
}

function parseLocalDateKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = localDateFromKey(value);
  return formatLocalDate(parsed) === value ? value : null;
}

function localDateFromKey(value: string): LocalDate {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function formatLocalDate(date: LocalDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
