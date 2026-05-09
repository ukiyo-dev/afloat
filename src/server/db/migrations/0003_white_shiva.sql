ALTER TABLE "computed_views" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."computed_view_kind";--> statement-breakpoint
CREATE TYPE "public"."computed_view_kind" AS ENUM('private');--> statement-breakpoint
ALTER TABLE "computed_views" ALTER COLUMN "kind" SET DATA TYPE "public"."computed_view_kind" USING "kind"::"public"."computed_view_kind";