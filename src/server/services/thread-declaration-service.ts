import { db } from "@/server/db/client";
import {
  deleteThreadDeclaration,
  upsertThreadDeclaration
} from "@/server/db/thread-declarations";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { loadPrivateView } from "@/server/services/view-service";
import { validateThreadDeclaration } from "@/server/services/workbench-validation";

export interface ThreadDeclarationInput {
  group: string;
  item: string;
  expectedMinutes: number | null;
  deadline: Date | null;
}

export async function saveThreadDeclaration(input: ThreadDeclarationInput) {
  validateThreadDeclaration(input);
  const ownerId = await getCurrentOwnerId();
  return upsertThreadDeclaration(db, ownerId, input);
}

export async function deleteEmptyThreadDeclaration(group: string, item: string): Promise<void> {
  const view = await loadPrivateView();
  const thread = view.threads.find((candidate) => candidate.group === group && candidate.item === item);
  if (!thread?.canDelete) {
    throw new Error("Only empty declared threads can be deleted.");
  }

  const ownerId = await getCurrentOwnerId();
  await deleteThreadDeclaration(db, ownerId, group, item);
}
