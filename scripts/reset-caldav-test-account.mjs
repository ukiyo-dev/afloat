import postgres from "postgres";

const SEMANTIC_CALENDARS = [
  { slug: "afloat-ideal", name: "理想", semantic: "ideal" },
  { slug: "afloat-leisure", name: "娱乐", semantic: "leisure" },
  { slug: "afloat-rest", name: "休息", semantic: "rest" },
  { slug: "afloat-external-shift", name: "外部偏移", semantic: "externalShift" },
  { slug: "afloat-internal-shift", name: "内部偏移", semantic: "internalShift" }
];

const serverUrl = requiredEnv("CALDAV_SERVER_URL");
const username = requiredEnv("CALDAV_USERNAME");
const password = requiredEnv("CALDAV_PASSWORD");
const databaseUrl = requiredEnv("DATABASE_URL");
const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
const baseUrl = new URL(serverUrl.endsWith("/") ? serverUrl : `${serverUrl}/`);

const homeUrl = await discoverCalendarHome();
const existingCalendars = await listCalendars(homeUrl);
console.log(`Discovered ${existingCalendars.length} existing calendars.`);

for (const calendar of existingCalendars) {
  const deleted = await deleteCalendarCollection(calendar);
  if (!deleted) {
    const deletedEvents = await deleteCalendarEvents(calendar);
    console.log(`Cleared ${deletedEvents} events from ${calendar.name}.`);
  }
}

const createdCalendars = [];
for (const calendar of SEMANTIC_CALENDARS) {
  const url = new URL(`${calendar.slug}/`, homeUrl);
  await createCalendar(url, calendar.name);
  createdCalendars.push({
    ...calendar,
    externalCalendarId: url.pathname
  });
}

await resetLocalCalendarCache(createdCalendars);
console.log("Reset complete.");
console.log(
  JSON.stringify(
    createdCalendars.map((calendar) => ({
      name: calendar.name,
      semantic: calendar.semantic,
      externalCalendarId: calendar.externalCalendarId
    })),
    null,
    2
  )
);

async function discoverCalendarHome() {
  const principal = await davRequest(baseUrl, {
    method: "PROPFIND",
    depth: "0",
    body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`
  });
  const principalHref = firstXmlText(xmlBlocks(principal, "current-user-principal")[0] ?? "", "href");
  if (!principalHref) {
    throw new Error("current-user-principal was not returned.");
  }

  const home = await davRequest(new URL(principalHref, baseUrl), {
    method: "PROPFIND",
    depth: "0",
    body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`
  });
  const homeHref = firstXmlText(xmlBlocks(home, "calendar-home-set")[0] ?? "", "href");
  if (!homeHref) {
    throw new Error("calendar-home-set was not returned.");
  }

  return new URL(homeHref, baseUrl);
}

async function listCalendars(homeUrl) {
  const xml = await davRequest(homeUrl, {
    method: "PROPFIND",
    depth: "1",
    body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype />
    <d:displayname />
  </d:prop>
</d:propfind>`
  });

  return xmlBlocks(xml, "response")
    .filter((block) => hasXmlTag(block, "calendar"))
    .map((block) => {
      const href = firstXmlText(block, "href");
      return href
        ? {
            url: new URL(href, baseUrl),
            name: firstXmlText(block, "displayname") ?? href
          }
        : null;
    })
    .filter(Boolean);
}

async function deleteCalendarCollection(calendar) {
  const response = await fetch(calendar.url, {
    method: "DELETE",
    headers: { Authorization: authorization }
  });

  if (response.ok) {
    console.log(`Deleted calendar collection ${calendar.name}.`);
    return true;
  }

  console.log(`Could not delete calendar collection ${calendar.name}; clearing events instead.`);
  return false;
}

async function deleteCalendarEvents(calendar) {
  const xml = await davRequest(calendar.url, {
    method: "REPORT",
    depth: "1",
    body: `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT" />
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`
  });
  const eventUrls = xmlBlocks(xml, "response")
    .map((block) => firstXmlText(block, "href"))
    .filter(Boolean)
    .map((href) => new URL(href, baseUrl));

  let deleted = 0;
  for (const eventUrl of eventUrls) {
    const response = await fetch(eventUrl, {
      method: "DELETE",
      headers: { Authorization: authorization }
    });
    if (response.ok) {
      deleted += 1;
    }
  }
  return deleted;
}

async function createCalendar(url, displayName) {
  await davRequest(url, {
    method: "MKCALENDAR",
    depth: "0",
    body: `<?xml version="1.0" encoding="utf-8" ?>
<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:set>
    <d:prop>
      <d:displayname>${escapeXml(displayName)}</d:displayname>
      <c:supported-calendar-component-set>
        <c:comp name="VEVENT" />
      </c:supported-calendar-component-set>
    </d:prop>
  </d:set>
</c:mkcalendar>`
  });
  console.log(`Created calendar ${displayName}.`);
}

async function resetLocalCalendarCache(createdCalendars) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [owner] = await sql`select id from owners order by created_at limit 1`;
    if (!owner) {
      console.log("No local owner found; skipped local DB reset.");
      return;
    }

    await sql`delete from calendar_events_raw where owner_id = ${owner.id}`;
    await sql`delete from calendar_sources where owner_id = ${owner.id}`;

    for (const calendar of createdCalendars) {
      await sql`
        insert into calendar_sources (
          owner_id,
          provider,
          external_calendar_id,
          name,
          semantic,
          enabled
        )
        values (
          ${owner.id},
          'caldav',
          ${calendar.externalCalendarId},
          ${calendar.name},
          ${calendar.semantic},
          true
        )
      `;
    }
    console.log("Cleared local calendar cache and inserted semantic mappings.");
  } finally {
    await sql.end();
  }
}

async function davRequest(url, { method, depth, body }) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      Depth: depth,
      "Content-Type": "application/xml; charset=utf-8"
    },
    body
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${url.pathname} failed: ${response.status} ${response.statusText}`);
  }
  return text;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function xmlBlocks(xml, localName) {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${localName}>`,
    "gi"
  );
  return [...xml.matchAll(pattern)].map((match) => match[1] ?? "");
}

function firstXmlText(xml, localName) {
  const [block] = xmlBlocks(xml, localName);
  return block === undefined ? null : decodeXml(block.trim());
}

function hasXmlTag(xml, localName) {
  return new RegExp(`<(?:[\\w-]+:)?${localName}\\b`, "i").test(xml);
}

function decodeXml(value) {
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  const normalized = cdata?.[1] ?? value;
  return normalized
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
