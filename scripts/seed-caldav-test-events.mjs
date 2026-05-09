const serverUrl = requiredEnv("CALDAV_SERVER_URL");
const username = requiredEnv("CALDAV_USERNAME");
const password = requiredEnv("CALDAV_PASSWORD");
const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
const baseUrl = new URL(serverUrl.endsWith("/") ? serverUrl : `${serverUrl}/`);

const events = [
  {
    calendarPath: "/19249158884/calendars/afloat-ideal/",
    uid: "afloat-test-ideal-1",
    summary: "Afloat：同步闭环 1",
    startAt: "20260506T200000Z",
    endAt: "20260506T220000Z"
  },
  {
    calendarPath: "/19249158884/calendars/afloat-internal-shift/",
    uid: "afloat-test-internal-1",
    summary: "刷手机",
    startAt: "20260506T203000Z",
    endAt: "20260506T210000Z"
  },
  {
    calendarPath: "/19249158884/calendars/afloat-rest/",
    uid: "afloat-test-rest-1",
    summary: "睡眠",
    startAt: "20260506T233000Z",
    endAt: "20260507T073000Z"
  },
  {
    calendarPath: "/19249158884/calendars/afloat-leisure/",
    uid: "afloat-test-leisure-1",
    summary: "游戏开发：玩同类游戏 1",
    startAt: "20260507T090000Z",
    endAt: "20260507T100000Z"
  },
  {
    calendarPath: "/19249158884/calendars/afloat-external-shift/",
    uid: "afloat-test-external-1",
    summary: "临时会议",
    startAt: "20260507T103000Z",
    endAt: "20260507T110000Z"
  },
  {
    calendarPath: "/19249158884/calendars/afloat-ideal/",
    uid: "afloat-test-ideal-2",
    summary: "Afloat：同步闭环 2",
    startAt: "20260509T100000Z",
    endAt: "20260509T120000Z"
  }
];

for (const event of events) {
  const url = new URL(`${event.calendarPath}${event.uid}.ics`, baseUrl);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": "text/calendar; charset=utf-8"
    },
    body: toIcs(event)
  });

  if (!response.ok) {
    throw new Error(`PUT ${event.uid} failed: ${response.status} ${response.statusText}`);
  }

  console.log(`Created event ${event.summary}.`);
}

function toIcs(event) {
  const now = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Afloat//Dev Test//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${now}`,
    `CREATED:${now}`,
    `LAST-MODIFIED:${now}`,
    `DTSTART:${event.startAt}`,
    `DTEND:${event.endAt}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function escapeIcsText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}
