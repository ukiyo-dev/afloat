import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { personalRuleBreaks, personalRules } from "./schema";

export async function listPersonalRules(database: Database, ownerId: string) {
  const [rules, breaks] = await Promise.all([
    database
      .select()
      .from(personalRules)
      .where(eq(personalRules.ownerId, ownerId))
      .orderBy(desc(personalRules.createdAt)),
    database
      .select()
      .from(personalRuleBreaks)
      .where(eq(personalRuleBreaks.ownerId, ownerId))
      .orderBy(desc(personalRuleBreaks.brokenDate), desc(personalRuleBreaks.createdAt))
  ]);

  const breaksByRuleId = new Map<string, typeof breaks>();
  for (const ruleBreak of breaks) {
    const existing = breaksByRuleId.get(ruleBreak.ruleId) ?? [];
    existing.push(ruleBreak);
    breaksByRuleId.set(ruleBreak.ruleId, existing);
  }

  return rules.map((rule) => ({
    ...rule,
    breaks: breaksByRuleId.get(rule.id) ?? []
  }));
}

export async function createPersonalRule(
  database: Database,
  ownerId: string,
  input: {
    title: string;
    content: string;
    startDate: string;
    commitment: "test" | "signed";
  }
) {
  const [row] = await database
    .insert(personalRules)
    .values({
      ownerId,
      title: input.title,
      content: input.content,
      startDate: input.startDate,
      commitment: input.commitment,
      signedDate: input.commitment === "signed" ? input.startDate : null,
      signedAt: input.commitment === "signed" ? sql`now()` : null
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create personal rule.");
  }

  return row;
}

export async function insertPersonalRuleBreak(
  database: Database,
  ownerId: string,
  input: {
    ruleId: string;
    brokenDate: string;
    scene: string;
    reason: string;
  }
) {
  const rule = await database.query.personalRules.findFirst({
    where: and(
      eq(personalRules.id, input.ruleId),
      eq(personalRules.ownerId, ownerId),
      eq(personalRules.status, "active")
    )
  });
  if (!rule) {
    throw new Error("Active rule not found.");
  }

  const [row] = await database
    .insert(personalRuleBreaks)
    .values({
      ownerId,
      ruleId: input.ruleId,
      brokenDate: input.brokenDate,
      scene: input.scene,
      reason: input.reason,
      type:
        rule.commitment === "signed" && rule.signedDate && input.brokenDate >= rule.signedDate
          ? "rule_break"
          : "test_break"
    })
    .returning();

  if (!row) {
    throw new Error("Failed to record personal rule break.");
  }

  return row;
}

export async function signPersonalRule(
  database: Database,
  ownerId: string,
  input: { ruleId: string; signedDate: string }
) {
  const [row] = await database
    .update(personalRules)
    .set({
      commitment: "signed",
      signedDate: input.signedDate,
      signedAt: sql`now()`,
      updatedAt: sql`now()`
    })
    .where(and(
      eq(personalRules.id, input.ruleId),
      eq(personalRules.ownerId, ownerId),
      eq(personalRules.status, "active"),
      eq(personalRules.commitment, "test")
    ))
    .returning();

  if (!row) throw new Error("Active test rule not found.");
  return row;
}

export async function archivePersonalRule(
  database: Database,
  ownerId: string,
  input: {
    ruleId: string;
    archiveReason: string | null;
  }
) {
  const [row] = await database
    .update(personalRules)
    .set({
      status: "archived",
      archivedAt: sql`now()`,
      archiveReason: input.archiveReason,
      updatedAt: sql`now()`
    })
    .where(and(eq(personalRules.id, input.ruleId), eq(personalRules.ownerId, ownerId)))
    .returning();

  if (!row) {
    throw new Error("Rule not found.");
  }

  return row;
}

export async function deleteArchivedPersonalRule(
  database: Database,
  ownerId: string,
  ruleId: string
) {
  const [row] = await database
    .delete(personalRules)
    .where(
      and(
        eq(personalRules.id, ruleId),
        eq(personalRules.ownerId, ownerId),
        eq(personalRules.status, "archived")
      )
    )
    .returning();

  if (!row) {
    throw new Error("Archived rule not found.");
  }

  return row;
}
