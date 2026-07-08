CREATE TYPE "public"."personal_rule_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "personal_rule_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"broken_date" text NOT NULL,
	"scene" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"covenant" text NOT NULL,
	"violation_test" text NOT NULL,
	"start_date" text NOT NULL,
	"status" "personal_rule_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_rule_breaks" ADD CONSTRAINT "personal_rule_breaks_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_rule_breaks" ADD CONSTRAINT "personal_rule_breaks_rule_id_personal_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."personal_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_rules" ADD CONSTRAINT "personal_rules_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_rule_breaks_owner_idx" ON "personal_rule_breaks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "personal_rule_breaks_rule_date_idx" ON "personal_rule_breaks" USING btree ("rule_id","broken_date");--> statement-breakpoint
CREATE INDEX "personal_rules_owner_idx" ON "personal_rules" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "personal_rules_owner_status_idx" ON "personal_rules" USING btree ("owner_id","status");