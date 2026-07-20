ALTER TABLE "thread_declarations"
  ALTER COLUMN "deadline" SET DATA TYPE date
  USING ("deadline" AT TIME ZONE 'UTC')::date;--> statement-breakpoint
ALTER TABLE "thread_declarations" ADD COLUMN "start_date" date;
