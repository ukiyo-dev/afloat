import ICAL from "ical.js";

import type { DateRange, RawCalendarEvent } from "@/server/domain/types";

export interface IcsEvent {
  externalEventId: string;
  icalUid: string | null;
  title: string;
  startAt: Date;
  endAt: Date;
  timezone: string | null;
  providerUpdatedAt: Date | null;
  rawIcs: string;
}

export function parseIcsEvents(rawIcs: string): IcsEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(rawIcs));
  return calendar.getAllSubcomponents("vevent").flatMap((component: ICAL.Component) => {
    const event = new ICAL.Event(component);
    const startAt = event.startDate.toJSDate();
    const endAt = event.endDate.toJSDate();

    if (!isValidRange({ startAt, endAt })) {
      return [];
    }

    const uid = event.uid || component.getFirstPropertyValue("uid")?.toString() || null;
    const recurrenceId = component.getFirstPropertyValue("recurrence-id")?.toString();
    const externalEventId = recurrenceId && uid ? `${uid}-${recurrenceId}` : (uid ?? crypto.randomUUID());
    const lastModified = component.getFirstPropertyValue("last-modified");

    return [
      {
        externalEventId,
        icalUid: uid,
        title: event.summary || "(untitled)",
        startAt,
        endAt,
        timezone: event.startDate.zone?.tzid ?? null,
        providerUpdatedAt: toDateOrNull(lastModified),
        rawIcs: component.toString()
      }
    ];
  });
}

export function toRawCalendarEvents(
  calendarSourceId: string,
  rawIcs: string,
  etag?: string | null
): RawCalendarEvent[] {
  return parseIcsEvents(rawIcs).map((event) => ({
    id: event.externalEventId,
    calendarSourceId,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    externalEventId: event.externalEventId,
    rawIcs: event.rawIcs,
    etag,
    icalUid: event.icalUid,
    providerUpdatedAt: event.providerUpdatedAt
  }));
}

function isValidRange(range: DateRange): boolean {
  return !Number.isNaN(range.startAt.getTime()) && range.startAt < range.endAt;
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "object" && "toJSDate" in value && typeof value.toJSDate === "function") {
    return value.toJSDate();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
