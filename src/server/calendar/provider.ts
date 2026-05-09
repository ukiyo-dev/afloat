import type { DateRange, RawCalendarEvent } from "@/server/domain/types";
import { toRawCalendarEvents } from "@/server/calendar/ical";
import { firstXmlText, hasXmlTag, xmlBlocks } from "@/server/calendar/xml";

export interface CalendarProviderCalendar {
  id: string;
  name: string;
}

export interface CalendarProvider {
  listCalendars(): Promise<CalendarProviderCalendar[]>;
  listEvents(calendarId: string, range: DateRange): Promise<RawCalendarEvent[]>;
}

export interface CalDavProviderOptions {
  serverUrl: string;
  username: string;
  password: string;
}

export class CalDavProvider implements CalendarProvider {
  private readonly baseUrl: URL;
  private readonly authorization: string;

  constructor(options: CalDavProviderOptions) {
    this.baseUrl = new URL(options.serverUrl.endsWith("/") ? options.serverUrl : `${options.serverUrl}/`);
    this.authorization = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
  }

  async listCalendars(): Promise<CalendarProviderCalendar[]> {
    const homeUrl = await this.discoverCalendarHome();
    const response = await this.request(homeUrl, {
      method: "PROPFIND",
      headers: { Depth: "1" },
      body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype />
    <d:displayname />
    <cs:getctag />
  </d:prop>
</d:propfind>`
    });
    const xml = await response.text();

    return xmlBlocks(xml, "response")
      .filter((block) => hasXmlTag(block, "calendar"))
      .map((block) => {
        const href = firstXmlText(block, "href");
        if (!href) {
          return null;
        }
        return {
          id: this.urlFromHref(href).pathname,
          name: firstXmlText(block, "displayname") || this.urlFromHref(href).pathname
        };
      })
      .filter((calendar): calendar is CalendarProviderCalendar => calendar !== null);
  }

  async listEvents(calendarId: string, range: DateRange): Promise<RawCalendarEvent[]> {
    const calendarUrl = this.urlFromHref(calendarId);
    const response = await this.request(calendarUrl, {
      method: "REPORT",
      headers: { Depth: "1" },
      body: `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${formatCalDavDate(range.startAt)}" end="${formatCalDavDate(range.endAt)}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`
    });
    const xml = await response.text();

    return xmlBlocks(xml, "response").flatMap((block) => {
      const calendarData = firstXmlText(block, "calendar-data");
      if (!calendarData) {
        return [];
      }
      return toRawCalendarEvents(calendarId, calendarData, firstXmlText(block, "getetag"));
    });
  }

  private async discoverCalendarHome(): Promise<URL> {
    const principalResponse = await this.request(this.baseUrl, {
      method: "PROPFIND",
      headers: { Depth: "0" },
      body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`
    });
    const principalXml = await principalResponse.text();
    const principalHref = firstXmlText(xmlBlocks(principalXml, "current-user-principal")[0] ?? "", "href");

    if (!principalHref) {
      throw new Error("CalDAV discovery failed: current-user-principal was not returned.");
    }

    const homeResponse = await this.request(this.urlFromHref(principalHref), {
      method: "PROPFIND",
      headers: { Depth: "0" },
      body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`
    });
    const homeXml = await homeResponse.text();
    const homeHref = firstXmlText(xmlBlocks(homeXml, "calendar-home-set")[0] ?? "", "href");

    if (!homeHref) {
      throw new Error("CalDAV discovery failed: calendar-home-set was not returned.");
    }

    return this.urlFromHref(homeHref);
  }

  private async request(url: URL, init: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authorization,
        "Content-Type": "application/xml; charset=utf-8",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`CalDAV request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  private urlFromHref(href: string): URL {
    return new URL(href, this.baseUrl);
  }
}

function formatCalDavDate(date: Date): string {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(".000", "");
}
