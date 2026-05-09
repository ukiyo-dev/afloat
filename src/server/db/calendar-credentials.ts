import { eq } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "@/server/crypto/encryption";

import type { Database } from "./client";
import { calendarCredentials } from "./schema";

export interface CalDavCredential {
  id: string | null;
  serverUrl: string;
  username: string;
  password: string;
}

export interface CalDavCredentialSummary {
  configured: boolean;
  source: "database" | "environment" | "none";
  serverUrl: string | null;
  username: string | null;
}

export async function loadCalDavCredential(
  database: Database,
  ownerId: string
): Promise<CalDavCredential | null> {
  const row = await database.query.calendarCredentials.findFirst({
    where: eq(calendarCredentials.ownerId, ownerId)
  });

  if (row) {
    return {
      id: row.id,
      serverUrl: row.serverUrl,
      username: row.username,
      password: decryptSecret(row.encryptedPassword)
    };
  }

  return loadEnvCalDavCredential();
}

export async function loadCalDavCredentialSummary(
  database: Database,
  ownerId: string
): Promise<CalDavCredentialSummary> {
  const row = await database.query.calendarCredentials.findFirst({
    where: eq(calendarCredentials.ownerId, ownerId)
  });

  if (row) {
    return {
      configured: true,
      source: "database",
      serverUrl: row.serverUrl,
      username: row.username
    };
  }

  const env = loadEnvCalDavCredential();
  return {
    configured: Boolean(env),
    source: env ? "environment" : "none",
    serverUrl: env?.serverUrl ?? null,
    username: env?.username ?? null
  };
}

export function loadEnvCalDavCredential(): CalDavCredential | null {
  const serverUrl = process.env.CALDAV_SERVER_URL;
  const username = process.env.CALDAV_USERNAME;
  const password = process.env.CALDAV_PASSWORD;

  if (!serverUrl || !username || !password) {
    return null;
  }

  return { id: null, serverUrl, username, password };
}

export async function saveCalDavCredential(
  database: Database,
  ownerId: string,
  input: Omit<CalDavCredential, "id">
): Promise<string> {
  const existing = await database.query.calendarCredentials.findFirst({
    where: eq(calendarCredentials.ownerId, ownerId)
  });

  if (existing) {
    const [row] = await database
      .update(calendarCredentials)
      .set({
        serverUrl: input.serverUrl,
        username: input.username,
        encryptedPassword: encryptSecret(input.password),
        updatedAt: new Date()
      })
      .where(eq(calendarCredentials.id, existing.id))
      .returning({ id: calendarCredentials.id });

    if (!row) {
      throw new Error("Failed to save CalDAV credential.");
    }

    return row.id;
  }

  const [row] = await database
    .insert(calendarCredentials)
    .values({
      ownerId,
      provider: "caldav",
      serverUrl: input.serverUrl,
      username: input.username,
      encryptedPassword: encryptSecret(input.password)
    })
    .returning({ id: calendarCredentials.id });

  if (!row) {
    throw new Error("Failed to save CalDAV credential.");
  }

  return row.id;
}

export async function updateCalDavCredential(
  database: Database,
  ownerId: string,
  input: {
    serverUrl: string;
    username: string;
    password?: string | null;
  }
): Promise<string> {
  const existing = await database.query.calendarCredentials.findFirst({
    where: eq(calendarCredentials.ownerId, ownerId)
  });

  if (!existing && !input.password) {
    throw new Error("CalDAV password is required.");
  }

  if (existing) {
    const [row] = await database
      .update(calendarCredentials)
      .set({
        serverUrl: input.serverUrl,
        username: input.username,
        ...(input.password ? { encryptedPassword: encryptSecret(input.password) } : {}),
        updatedAt: new Date()
      })
      .where(eq(calendarCredentials.id, existing.id))
      .returning({ id: calendarCredentials.id });

    if (!row) {
      throw new Error("Failed to save CalDAV credential.");
    }

    return row.id;
  }

  return saveCalDavCredential(database, ownerId, {
    serverUrl: input.serverUrl,
    username: input.username,
    password: input.password ?? ""
  });
}
