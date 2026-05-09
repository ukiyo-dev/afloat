import { db } from "@/server/db/client";
import { upsertCalendarSourceMapping } from "@/server/db/calendar-sources";
import { getCurrentOwnerId } from "@/server/services/owner-service";
import {
  type CalendarMappingValue,
  validateCalendarSourceMapping
} from "@/server/services/calendar-source-validation";

export interface CalendarSourceMappingInput {
  externalCalendarId: string;
  name: string;
  semantic: CalendarMappingValue;
  enabled?: boolean;
}

export async function saveCalendarSourceMapping(input: CalendarSourceMappingInput) {
  validateCalendarSourceMapping(input);
  const ownerId = await getCurrentOwnerId();
  return upsertCalendarSourceMapping(db, ownerId, {
    externalCalendarId: input.externalCalendarId,
    name: input.name,
    semantic: input.semantic === "none" ? "ideal" : input.semantic,
    enabled: input.semantic === "none" ? false : input.enabled ?? true
  });
}
