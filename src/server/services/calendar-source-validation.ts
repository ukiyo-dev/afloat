import type { SemanticKind } from "@/server/domain/types";

export type CalendarMappingValue = SemanticKind | "none";

export const SEMANTIC_OPTIONS: Array<{ value: SemanticKind; label: string }> = [
  { value: "ideal", label: "工作" },
  { value: "leisure", label: "娱乐" },
  { value: "rest", label: "休息" },
  { value: "externalShift", label: "外部偏移" },
  { value: "internalShift", label: "内部偏移" }
];

const SEMANTICS: ReadonlySet<string> = new Set(SEMANTIC_OPTIONS.map((option) => option.value));

export function isSemanticKind(value: unknown): value is SemanticKind {
  return typeof value === "string" && SEMANTICS.has(value);
}

export function isCalendarMappingValue(value: unknown): value is CalendarMappingValue {
  return value === "none" || isSemanticKind(value);
}

export function validateCalendarSourceMapping(input: {
  externalCalendarId?: unknown;
  name?: unknown;
  semantic?: unknown;
}): asserts input is {
  externalCalendarId: string;
  name: string;
  semantic: CalendarMappingValue;
} {
  if (typeof input.externalCalendarId !== "string" || input.externalCalendarId.length === 0) {
    throw new Error("externalCalendarId is required.");
  }
  if (typeof input.name !== "string" || input.name.length === 0) {
    throw new Error("name is required.");
  }
  if (!isCalendarMappingValue(input.semantic)) {
    throw new Error("semantic is invalid.");
  }
}
