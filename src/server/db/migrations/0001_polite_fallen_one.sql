ALTER TABLE "settings" ADD COLUMN "default_dashboard_range" text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;