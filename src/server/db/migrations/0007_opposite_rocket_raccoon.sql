CREATE TYPE "public"."personal_rule_break_type" AS ENUM('test_break', 'rule_break');--> statement-breakpoint
CREATE TYPE "public"."personal_rule_commitment" AS ENUM('test', 'signed');--> statement-breakpoint
ALTER TABLE "personal_rule_breaks" ADD COLUMN "type" "personal_rule_break_type";--> statement-breakpoint
ALTER TABLE "personal_rules" ADD COLUMN "commitment" "personal_rule_commitment" DEFAULT 'signed' NOT NULL;--> statement-breakpoint
ALTER TABLE "personal_rules" ADD COLUMN "signed_date" text;--> statement-breakpoint
ALTER TABLE "personal_rules" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "personal_rules" SET "signed_date" = "start_date", "signed_at" = "created_at";--> statement-breakpoint
UPDATE "personal_rule_breaks" SET "type" = 'rule_break';--> statement-breakpoint
ALTER TABLE "personal_rule_breaks" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personal_rules" ALTER COLUMN "commitment" SET DEFAULT 'test';
