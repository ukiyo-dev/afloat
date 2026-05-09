import type { Database } from "./client";
import { owners, settings } from "./schema";

export async function ensureLocalOwner(database: Database): Promise<string> {
  const existing = await database.query.owners.findFirst();
  if (existing) {
    return existing.id;
  }

  const [owner] = await database
    .insert(owners)
    .values({ displayName: "Local owner" })
    .returning({ id: owners.id });

  if (!owner) {
    throw new Error("Failed to create local owner.");
  }

  await database.insert(settings).values({ ownerId: owner.id }).onConflictDoNothing();
  return owner.id;
}
