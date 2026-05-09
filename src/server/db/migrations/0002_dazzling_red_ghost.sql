DELETE FROM "computed_views" WHERE "kind" = 'public';--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "public_slug";
