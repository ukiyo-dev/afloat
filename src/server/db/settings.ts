import { eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { settings } from "./schema";

export async function loadSettings(database: Database, ownerId: string) {
  const existing = await database.query.settings.findFirst({
    where: eq(settings.ownerId, ownerId)
  });
  if (existing) {
    return existing;
  }

  const [created] = await database.insert(settings).values({ ownerId }).returning();
  if (!created) {
    throw new Error("Failed to create settings.");
  }
  return created;
}

export async function updateSettings(
  database: Database,
  ownerId: string,
  input: {
    publicPageEnabled?: boolean;
    defaultDashboardRange?: string;
    timezone?: string;
  }
) {
  const [row] = await database
    .insert(settings)
    .values({
      ownerId,
      ...(input.publicPageEnabled === undefined ? {} : { publicPageEnabled: input.publicPageEnabled }),
      ...(input.defaultDashboardRange === undefined
        ? {}
        : { defaultDashboardRange: input.defaultDashboardRange }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone })
    })
    .onConflictDoUpdate({
      target: settings.ownerId,
      set: {
        ...(input.publicPageEnabled === undefined
          ? {}
          : { publicPageEnabled: sql`excluded.public_page_enabled` }),
        ...(input.defaultDashboardRange === undefined
          ? {}
          : { defaultDashboardRange: sql`excluded.default_dashboard_range` }),
        ...(input.timezone === undefined ? {} : { timezone: sql`excluded.timezone` }),
        updatedAt: sql`now()`
      }
    })
    .returning();

  if (!row) {
    throw new Error("Failed to save settings.");
  }

  return row;
}
