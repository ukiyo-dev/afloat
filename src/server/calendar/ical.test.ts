import { describe, expect, it } from "vitest";

import { toRawCalendarEvents } from "./ical";
import { firstXmlText } from "./xml";

describe("CalDAV iCalendar parsing", () => {
  it("parses VEVENT calendar-data from a CDATA XML node", () => {
    const xml = `<cal:calendar-data><![CDATA[BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Afloat：同步 1
DTSTART:20260507T100000Z
DTEND:20260507T110000Z
LAST-MODIFIED:20260507T090000Z
END:VEVENT
END:VCALENDAR
]]></cal:calendar-data>`;

    const calendarData = firstXmlText(xml, "calendar-data");
    expect(calendarData).not.toBeNull();

    const [event] = toRawCalendarEvents("calendar-id", calendarData ?? "", "etag-1");
    expect(event).toMatchObject({
      calendarSourceId: "calendar-id",
      title: "Afloat：同步 1",
      externalEventId: "event-1",
      etag: "etag-1"
    });
    expect(event?.startAt.toISOString()).toBe("2026-05-07T10:00:00.000Z");
    expect(event?.endAt.toISOString()).toBe("2026-05-07T11:00:00.000Z");
  });

  it("keeps recurrence instances distinct from their parent UID", () => {
    const [event] = toRawCalendarEvents(
      "calendar-id",
      `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
RECURRENCE-ID:20260508T100000Z
SUMMARY:Afloat：同步 2
DTSTART:20260508T120000Z
DTEND:20260508T130000Z
END:VEVENT
END:VCALENDAR`
    );

    expect(event?.icalUid).toBe("event-1");
    expect(event?.externalEventId).toBe("event-1-2026-05-08T10:00:00Z");
    expect(event?.startAt.toISOString()).toBe("2026-05-08T12:00:00.000Z");
  });

  it("parses all-day events as midnight-to-midnight ranges", () => {
    const [event] = toRawCalendarEvents(
      "calendar-id",
      `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-1
SUMMARY:休息
DTSTART;VALUE=DATE:20260508
DTEND;VALUE=DATE:20260509
END:VEVENT
END:VCALENDAR`
    );

    expect(event?.startAt.toISOString()).toBe("2026-05-08T00:00:00.000Z");
    expect(event?.endAt.toISOString()).toBe("2026-05-09T00:00:00.000Z");
  });

  it("drops invalid zero-length events and preserves recurring masters without expansion", () => {
    const events = toRawCalendarEvents(
      "calendar-id",
      `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:zero
SUMMARY:invalid
DTSTART:20260508T100000Z
DTEND:20260508T100000Z
END:VEVENT
BEGIN:VEVENT
UID:recurring
SUMMARY:Afloat：同步 1
DTSTART:20260508T110000Z
DTEND:20260508T120000Z
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
END:VCALENDAR`
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      externalEventId: "recurring",
      title: "Afloat：同步 1"
    });
    expect(events[0]?.rawIcs).toContain("RRULE:FREQ=DAILY;COUNT=3");
  });
});
