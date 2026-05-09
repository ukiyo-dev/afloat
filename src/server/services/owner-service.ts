import { db } from "@/server/db/client";
import { ensureLocalOwner } from "@/server/db/owners";
import { requireAuthenticatedOwnerId } from "@/server/services/auth-service";

export async function getCurrentOwnerId(): Promise<string> {
  return requireAuthenticatedOwnerId();
}

export async function getLocalOwnerId(): Promise<string> {
  return ensureLocalOwner(db);
}
