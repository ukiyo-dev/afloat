ALTER TABLE "thread_declarations" ADD COLUMN "steady_daily" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "thread_declarations" SET "steady_daily" = true WHERE "daily_minutes" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_declarations" DROP COLUMN "daily_minutes";
