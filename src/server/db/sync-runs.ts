import { desc, eq } from "drizzle-orm";

import type { SyncKind } from "@/server/services/sync-result";

import type { Database } from "./client";
import { syncRuns } from "./schema";

export async function startSyncRun(
  database: Database,
  ownerId: string,
  kind: SyncKind,
  range?: { startAt: Date; endAt: Date }
): Promise<string> {
  const [row] = await database
    .insert(syncRuns)
    .values({
      ownerId,
      kind,
      status: "running",
      rangeStartAt: range?.startAt,
      rangeEndAt: range?.endAt
    })
    .returning({ id: syncRuns.id });

  if (!row) {
    throw new Error("Failed to start sync run.");
  }

  return row.id;
}

export async function finishSyncRun(
  database: Database,
  id: string,
  status: "succeeded" | "failed",
  errorMessage?: string
): Promise<void> {
  await database
    .update(syncRuns)
    .set({
      status,
      errorMessage,
      finishedAt: new Date()
    })
    .where(eq(syncRuns.id, id));
}

export async function loadLatestSyncRun(database: Database, ownerId: string) {
  return database.query.syncRuns.findFirst({
    where: eq(syncRuns.ownerId, ownerId),
    orderBy: [desc(syncRuns.startedAt)]
  });
}
