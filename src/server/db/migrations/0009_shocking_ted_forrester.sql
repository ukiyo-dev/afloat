DROP INDEX "notes_owner_date_idx_unique";--> statement-breakpoint
CREATE INDEX "notes_owner_date_idx" ON "notes" USING btree ("owner_id","date");