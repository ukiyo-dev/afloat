CREATE TYPE "public"."computed_view_kind" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."note_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."semantic_kind" AS ENUM('ideal', 'leisure', 'rest', 'externalShift', 'internalShift');--> statement-breakpoint
CREATE TYPE "public"."sync_run_kind" AS ENUM('recent', 'recalibrate');--> statement-breakpoint
CREATE TYPE "public"."sync_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "calendar_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider" text DEFAULT 'caldav' NOT NULL,
	"server_url" text NOT NULL,
	"username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"calendar_source_id" uuid NOT NULL,
	"provider" text DEFAULT 'caldav' NOT NULL,
	"external_calendar_id" text NOT NULL,
	"external_event_id" text NOT NULL,
	"etag" text,
	"ical_uid" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"timezone" text,
	"title" text NOT NULL,
	"raw_ics" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"credential_id" uuid,
	"provider" text DEFAULT 'caldav' NOT NULL,
	"external_calendar_id" text NOT NULL,
	"name" text NOT NULL,
	"semantic" "semantic_kind" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "computed_views" (
	"owner_id" uuid NOT NULL,
	"kind" "computed_view_kind" NOT NULL,
	"rule_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "computed_views_owner_id_kind_pk" PRIMARY KEY("owner_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"date" text NOT NULL,
	"body" text NOT NULL,
	"visibility" "note_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text DEFAULT 'Local owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"public_page_enabled" boolean DEFAULT false NOT NULL,
	"public_slug" text DEFAULT 'sample' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "sync_run_kind" NOT NULL,
	"status" "sync_run_status" NOT NULL,
	"range_start_at" timestamp with time zone,
	"range_end_at" timestamp with time zone,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "thread_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"item_name" text NOT NULL,
	"expected_minutes" integer,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_credentials" ADD CONSTRAINT "calendar_credentials_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events_raw" ADD CONSTRAINT "calendar_events_raw_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events_raw" ADD CONSTRAINT "calendar_events_raw_calendar_source_id_calendar_sources_id_fk" FOREIGN KEY ("calendar_source_id") REFERENCES "public"."calendar_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_credential_id_calendar_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."calendar_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computed_views" ADD CONSTRAINT "computed_views_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_declarations" ADD CONSTRAINT "thread_declarations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_credentials_owner_idx" ON "calendar_credentials" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "calendar_events_raw_owner_start_idx" ON "calendar_events_raw" USING btree ("owner_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_raw_owner_external_event_idx" ON "calendar_events_raw" USING btree ("owner_id","provider","external_calendar_id","external_event_id");--> statement-breakpoint
CREATE INDEX "calendar_sources_owner_idx" ON "calendar_sources" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sources_owner_external_idx" ON "calendar_sources" USING btree ("owner_id","provider","external_calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_owner_date_idx_unique" ON "notes" USING btree ("owner_id","date");--> statement-breakpoint
CREATE INDEX "sync_runs_owner_started_idx" ON "sync_runs" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "thread_declarations_owner_idx" ON "thread_declarations" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_declarations_owner_thread_idx" ON "thread_declarations" USING btree ("owner_id","group_name","item_name");