import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import type { DerivedViews, PrivateDerivedView } from "@/server/views/derived-view";

export const semanticKindEnum = pgEnum("semantic_kind", [
  "ideal",
  "leisure",
  "rest",
  "externalShift",
  "internalShift"
]);

export const noteVisibilityEnum = pgEnum("note_visibility", ["private", "public"]);
export const computedViewKindEnum = pgEnum("computed_view_kind", ["private"]);
export const syncRunKindEnum = pgEnum("sync_run_kind", ["recent", "recalibrate"]);
export const syncRunStatusEnum = pgEnum("sync_run_status", ["running", "succeeded", "failed"]);

export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull().default("Local owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const settings = pgTable("settings", {
  ownerId: uuid("owner_id")
    .primaryKey()
    .references(() => owners.id, { onDelete: "cascade" }),
  ruleVersion: integer("rule_version").notNull().default(1),
  publicPageEnabled: boolean("public_page_enabled").notNull().default(false),
  defaultDashboardRange: text("default_dashboard_range").notNull().default("day"),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const calendarCredentials = pgTable("calendar_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("caldav"),
  serverUrl: text("server_url").notNull(),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("calendar_credentials_owner_idx").on(table.ownerId)]);

export const calendarSources = pgTable(
  "calendar_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    credentialId: uuid("credential_id").references(() => calendarCredentials.id, {
      onDelete: "set null"
    }),
    provider: text("provider").notNull().default("caldav"),
    externalCalendarId: text("external_calendar_id").notNull(),
    name: text("name").notNull(),
    semantic: semanticKindEnum("semantic").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("calendar_sources_owner_idx").on(table.ownerId),
    uniqueIndex("calendar_sources_owner_external_idx").on(
      table.ownerId,
      table.provider,
      table.externalCalendarId
    )
  ]
);

export const calendarEventsRaw = pgTable(
  "calendar_events_raw",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    calendarSourceId: uuid("calendar_source_id")
      .notNull()
      .references(() => calendarSources.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("caldav"),
    externalCalendarId: text("external_calendar_id").notNull(),
    externalEventId: text("external_event_id").notNull(),
    etag: text("etag"),
    icalUid: text("ical_uid"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    timezone: text("timezone"),
    title: text("title").notNull(),
    rawIcs: text("raw_ics"),
    deleted: boolean("deleted").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true })
  },
  (table) => [
    index("calendar_events_raw_owner_start_idx").on(table.ownerId, table.startAt),
    uniqueIndex("calendar_events_raw_owner_external_event_idx").on(
      table.ownerId,
      table.provider,
      table.externalCalendarId,
      table.externalEventId
    )
  ]
);

export const threadDeclarations = pgTable(
  "thread_declarations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    group: text("group_name").notNull(),
    item: text("item_name").notNull(),
    expectedMinutes: integer("expected_minutes"),
    deadline: timestamp("deadline", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("thread_declarations_owner_idx").on(table.ownerId),
    uniqueIndex("thread_declarations_owner_thread_idx").on(table.ownerId, table.group, table.item)
  ]
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    body: text("body").notNull(),
    visibility: noteVisibilityEnum("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notes_owner_date_idx_unique").on(table.ownerId, table.date)
  ]
);

export const computedViews = pgTable(
  "computed_views",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    kind: computedViewKindEnum("kind").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    payload: jsonb("payload").$type<PrivateDerivedView>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull()
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.kind] })]
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    kind: syncRunKindEnum("kind").notNull(),
    status: syncRunStatusEnum("status").notNull(),
    rangeStartAt: timestamp("range_start_at", { withTimezone: true }),
    rangeEndAt: timestamp("range_end_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (table) => [index("sync_runs_owner_started_idx").on(table.ownerId, table.startedAt)]
);

export type ComputedViewsPayload = DerivedViews;
