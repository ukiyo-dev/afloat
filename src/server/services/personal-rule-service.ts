import { db } from "@/server/db/client";
import {
  archivePersonalRule,
  createPersonalRule,
  deleteArchivedPersonalRule,
  insertPersonalRuleBreak,
  listPersonalRules
} from "@/server/db/personal-rules";
import {
  buildPersonalRuleViews,
  type PersonalRuleView
} from "@/server/domain/personal-rules";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import { validateNoteDate } from "@/server/services/workbench-validation";

export interface PersonalRuleInput {
  title: string;
  content: string;
  startDate: string;
}

export interface PersonalRuleBreakInput {
  ruleId: string;
  brokenDate: string;
  scene: string;
  reason: string;
}

export interface PersonalRuleArchiveInput {
  ruleId: string;
  archiveReason: string | null;
}

export async function loadPersonalRuleViews(today: string): Promise<PersonalRuleView[]> {
  validateNoteDate(today);
  const ownerId = await getCurrentOwnerId();
  const rules = await listPersonalRules(db, ownerId);
  return buildPersonalRuleViews(
    rules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      content: rule.content,
      startDate: rule.startDate,
      status: rule.status,
      archivedAt: rule.archivedAt?.toISOString() ?? null,
      archiveReason: rule.archiveReason,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
      breaks: rule.breaks.map((ruleBreak) => ({
        id: ruleBreak.id,
        brokenDate: ruleBreak.brokenDate,
        scene: ruleBreak.scene,
        reason: ruleBreak.reason,
        createdAt: ruleBreak.createdAt.toISOString()
      }))
    })),
    today
  );
}

export async function savePersonalRule(input: PersonalRuleInput) {
  validatePersonalRuleInput(input);
  const ownerId = await getCurrentOwnerId();
  return createPersonalRule(db, ownerId, {
    title: input.title.trim(),
    content: input.content.trim(),
    startDate: input.startDate
  });
}

export async function recordPersonalRuleBreak(input: PersonalRuleBreakInput) {
  validatePersonalRuleBreakInput(input);
  const ownerId = await getCurrentOwnerId();
  return insertPersonalRuleBreak(db, ownerId, {
    ruleId: input.ruleId,
    brokenDate: input.brokenDate,
    scene: input.scene.trim(),
    reason: input.reason.trim()
  });
}

export async function stopPersonalRule(input: PersonalRuleArchiveInput) {
  if (input.ruleId.trim().length === 0) {
    throw new Error("ruleId is required.");
  }
  const ownerId = await getCurrentOwnerId();
  return archivePersonalRule(db, ownerId, {
    ruleId: input.ruleId,
    archiveReason: input.archiveReason?.trim() || null
  });
}

export async function deletePersonalRule(ruleId: string) {
  if (ruleId.trim().length === 0) {
    throw new Error("ruleId is required.");
  }
  const ownerId = await getCurrentOwnerId();
  return deleteArchivedPersonalRule(db, ownerId, ruleId);
}

function validatePersonalRuleInput(input: PersonalRuleInput): void {
  validateNoteDate(input.startDate);
  if (input.title.trim().length === 0) {
    throw new Error("title is required.");
  }
  if (input.content.trim().length === 0) {
    throw new Error("content is required.");
  }
}

function validatePersonalRuleBreakInput(input: PersonalRuleBreakInput): void {
  validateNoteDate(input.brokenDate);
  if (input.ruleId.trim().length === 0) {
    throw new Error("ruleId is required.");
  }
  if (input.scene.trim().length === 0) {
    throw new Error("scene is required.");
  }
  if (input.reason.trim().length === 0) {
    throw new Error("reason is required.");
  }
}
