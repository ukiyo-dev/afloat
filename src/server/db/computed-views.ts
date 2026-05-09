import { and, eq, sql } from "drizzle-orm";

import type { DerivedViews } from "@/server/views/derived-view";

import type { Database } from "./client";
import { computedViews } from "./schema";

export async function saveComputedViews(
  database: Database,
  ownerId: string,
  ruleVersion: number,
  views: DerivedViews
): Promise<void> {
  const generatedAt = new Date(views.private.generatedAt);
  await database
    .insert(computedViews)
    .values({
      ownerId,
      kind: "private",
      ruleVersion,
      generatedAt,
      payload: views.private
    })
    .onConflictDoUpdate({
      target: [computedViews.ownerId, computedViews.kind],
      set: {
        ruleVersion: sql`excluded.rule_version`,
        generatedAt: sql`excluded.generated_at`,
        payload: sql`excluded.payload`
      }
    });
}

export async function loadComputedView(
  database: Database,
  ownerId: string,
  kind: "private"
) {
  return database.query.computedViews.findFirst({
    where: and(eq(computedViews.ownerId, ownerId), eq(computedViews.kind, kind))
  });
}

export async function loadPrivateComputedViewRow(
  database: Database,
  ownerId: string
) {
  return loadComputedView(database, ownerId, "private");
}
