import type { CalDavCredentialSummary } from "@/server/db/calendar-credentials";

export interface CalDavCredentialInput {
  serverUrl: string;
  username: string;
  password?: string | null;
}

export async function loadCurrentCalDavCredentialSummary(): Promise<CalDavCredentialSummary> {
  const [{ db }, { loadCalDavCredentialSummary }, { getCurrentOwnerId }] = await Promise.all([
    import("@/server/db/client"),
    import("@/server/db/calendar-credentials"),
    import("@/server/services/owner-service")
  ]);
  const ownerId = await getCurrentOwnerId();
  return loadCalDavCredentialSummary(db, ownerId);
}

export async function saveCurrentCalDavCredential(input: CalDavCredentialInput): Promise<void> {
  validateCalDavCredentialInput(input);
  const [{ db }, { updateCalDavCredential }, { getCurrentOwnerId }] = await Promise.all([
    import("@/server/db/client"),
    import("@/server/db/calendar-credentials"),
    import("@/server/services/owner-service")
  ]);
  const ownerId = await getCurrentOwnerId();
  await updateCalDavCredential(db, ownerId, {
    serverUrl: input.serverUrl.trim(),
    username: input.username.trim(),
    password: input.password?.trim() || null
  });
}

export function validateCalDavCredentialInput(input: CalDavCredentialInput): void {
  let url: URL;
  try {
    url = new URL(input.serverUrl);
  } catch {
    throw new Error("serverUrl must be a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("serverUrl must use http or https.");
  }
  if (input.username.trim().length === 0) {
    throw new Error("username is required.");
  }
  if (input.password !== undefined && input.password !== null && input.password.trim().length === 0) {
    throw new Error("password cannot be blank.");
  }
}
