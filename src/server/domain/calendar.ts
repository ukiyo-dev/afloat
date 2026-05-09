import { parseTitle } from "./title-parser";
import type {
  CalendarSource,
  Layer,
  ParsedEvent,
  RawCalendarEvent,
  SemanticKind
} from "./types";

export function semanticLayer(kind: SemanticKind): Layer {
  return kind === "externalShift" || kind === "internalShift" ? "shift" : "plan";
}

export function parseCalendarEvents(
  sources: CalendarSource[],
  rawEvents: RawCalendarEvent[]
): ParsedEvent[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return rawEvents.flatMap((event) => {
    const source = sourceById.get(event.calendarSourceId);
    if (!source) {
      return [];
    }

    return [
      {
        id: event.id,
        calendarSourceId: event.calendarSourceId,
        layer: semanticLayer(source.semantic),
        kind: source.semantic,
        startAt: event.startAt,
        endAt: event.endAt,
        title: parseTitle(event.title)
      }
    ];
  });
}
