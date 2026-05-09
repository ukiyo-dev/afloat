import type { NoteInput } from "@/server/services/note-service";
import {
  isDashboardRange,
  isValidTimeZone
} from "@/server/services/dashboard-range";
import type { DashboardSettingsInput } from "@/server/services/settings-service";
import type { ThreadDeclarationInput } from "@/server/services/thread-declaration-service";

export function validateNote(input: NoteInput): void {
  validateNoteDate(input.date);
  if (input.body.trim().length === 0) {
    throw new Error("body is required.");
  }
  if (input.visibility !== "private" && input.visibility !== "public") {
    throw new Error("visibility is invalid.");
  }
}

export function validateNoteDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date must be YYYY-MM-DD.");
  }
}

export function validateDashboardSettings(input: DashboardSettingsInput): void {
  if (!isDashboardRange(input.defaultDashboardRange)) {
    throw new Error("defaultDashboardRange is invalid.");
  }
  if (!isValidTimeZone(input.timezone)) {
    throw new Error("timezone is invalid.");
  }
}

export function validateThreadDeclaration(input: ThreadDeclarationInput): void {
  if (input.group.trim().length === 0 || input.item.trim().length === 0) {
    throw new Error("group and item are required.");
  }
  if (
    input.expectedMinutes !== null &&
    (!Number.isInteger(input.expectedMinutes) || input.expectedMinutes < 0)
  ) {
    throw new Error("expectedMinutes must be a non-negative integer.");
  }
}
