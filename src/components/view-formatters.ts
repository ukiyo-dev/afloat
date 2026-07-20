export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDuration(totalMinutes: number | null | undefined): string {
  if (totalMinutes === null || totalMinutes === undefined) return "---";
  if (totalMinutes === 0) return "0m";

  const roundedMinutes = Math.round(totalMinutes);
  const absoluteMinutes = Math.abs(roundedMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const sign = roundedMinutes < 0 ? "-" : "";
  
  if (hours > 0 && minutes > 0) {
    return `${sign}${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${sign}${hours}h`;
  } else {
    return `${sign}${minutes}m`;
  }
}

export function formatGeneratedAt(value: string, timezone?: string) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error();
    
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(d);
    
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    const hour = parts.find(p => p.type === "hour")?.value;
    const minute = parts.find(p => p.type === "minute")?.value;
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch (e) {
    return value.replace("T", " ").slice(0, 16);
  }
}

export function timeRange(startAt: string, endAt: string, timezone?: string) {
  try {
    const formatTime = (isoString: string) => {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) throw new Error();
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(d);
    };
    return `${formatTime(startAt)}-${formatTime(endAt)}`;
  } catch (e) {
    return `${startAt.slice(11, 16)}-${endAt.slice(11, 16)}`;
  }
}

export function timelineTimeRange(
  startAt: string,
  endAt: string,
  timezone: string | undefined,
  referenceDate: string
) {
  return {
    startTime: formatTimeOnly(startAt, timezone),
    endTime: formatTimeOnly(endAt, timezone),
    startDayOffset: dayOffsetFromReference(startAt, timezone, referenceDate),
    endDayOffset: dayOffsetFromReference(endAt, timezone, referenceDate)
  };
}

function formatTimeOnly(value: string, timezone?: string) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error();
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(d);
  } catch (e) {
    return value.slice(11, 16);
  }
}

function dayOffsetFromReference(value: string, timezone: string | undefined, referenceDate: string) {
  const localDate = localDateKey(value, timezone);
  const referenceKey = referenceDate.slice(0, 10);
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(referenceKey)) {
    return 0;
  }
  return daysBetween(referenceKey, localDate);
}

function localDateKey(value: string, timezone?: string) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(d);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) throw new Error();
    return `${year}-${month}-${day}`;
  } catch (e) {
    return value.slice(0, 10);
  }
}

function daysBetween(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  if (
    startYear === undefined ||
    startMonth === undefined ||
    startDay === undefined ||
    endYear === undefined ||
    endMonth === undefined ||
    endDay === undefined
  ) {
    return 0;
  }

  const startTime = Date.UTC(startYear, startMonth - 1, startDay);
  const endTime = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endTime - startTime) / 86_400_000);
}

export function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    idealFulfilled: "工作兑现",
    leisureFulfilled: "娱乐兑现",
    restFulfilled: "休息兑现",
    externalShift: "外部偏移",
    internalShift: "内部偏移",
    ideal: "工作计划",
    leisure: "娱乐计划",
    rest: "休息计划"
  };
  return labels[kind] ?? kind;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    upcoming: "即将到来",
    fulfilled: "已兑现",
    scheduled: "已安排",
    stale: "需要关注",
    needsScheduling: "仍需安排",
    tightPace: "节奏紧张",
    imbalanced: "结构失衡",
    expired: "已过期",
    untracked: "未设置可行性字段"
  };
  return labels[status] ?? status;
}
