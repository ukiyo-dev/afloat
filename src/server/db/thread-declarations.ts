import { and, eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { threadDeclarations } from "./schema";

export async function upsertThreadDeclaration(
  database: Database,
  ownerId: string,
  input: {
    group: string;
    item: string;
    expectedMinutes: number | null;
    start: Date | null;
    deadline: Date | null;
  }
) {
  const [row] = await database
    .insert(threadDeclarations)
    .values({
      ownerId,
      group: input.group,
      item: input.item,
      expectedMinutes: input.expectedMinutes,
      start: input.start,
      deadline: input.deadline
    })
    .onConflictDoUpdate({
      target: [threadDeclarations.ownerId, threadDeclarations.group, threadDeclarations.item],
      set: {
        expectedMinutes: sql`excluded.expected_minutes`,
        start: sql`excluded.start_date`,
        deadline: sql`excluded.deadline`,
        updatedAt: sql`now()`
      }
    })
    .returning();

  if (!row) {
    throw new Error("Failed to save thread declaration.");
  }

  return row;
}

export async function deleteThreadDeclaration(
  database: Database,
  ownerId: string,
  group: string,
  item: string
): Promise<void> {
  await database
    .delete(threadDeclarations)
    .where(
      and(
        eq(threadDeclarations.ownerId, ownerId),
        eq(threadDeclarations.group, group),
        eq(threadDeclarations.item, item)
      )
    );
}
