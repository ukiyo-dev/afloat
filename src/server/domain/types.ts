export type PlanKind = "ideal" | "leisure" | "rest";
export type ShiftKind = "externalShift" | "internalShift";
export type SemanticKind = PlanKind | ShiftKind;
export type Layer = "plan" | "shift";
export type FactKind =
  | "idealFulfilled"
  | "leisureFulfilled"
  | "restFulfilled"
  | ShiftKind;

export type QualityMark = "excellent" | "uncertain" | null;

export interface DateRange {
  startAt: Date;
  endAt: Date;
}

export interface RawCalendarEvent extends DateRange {
  id: string;
  calendarSourceId: string;
  title: string;
  timezone?: string | null;
  externalEventId?: string | null;
  etag?: string | null;
  icalUid?: string | null;
  rawIcs?: string | null;
  providerUpdatedAt?: Date | null;
}

export interface CalendarSource {
  id: string;
  name: string;
  semantic: SemanticKind;
  provider?: string;
  externalCalendarId?: string;
}

export interface ParsedTitle {
  rawTitle: string;
  titleBody: string;
  group: string;
  item: string;
  sequence: number | null;
  quality: QualityMark;
}

export interface ParsedEvent extends DateRange {
  id: string;
  calendarSourceId: string;
  layer: Layer;
  kind: SemanticKind;
  title: ParsedTitle;
}

export interface TimeSegment extends DateRange {
  eventId: string;
  kind: SemanticKind;
  title: ParsedTitle;
}

export interface FactSegment extends DateRange {
  kind: FactKind;
  sourceEventId: string;
  title: ParsedTitle;
  coveredPlanEventId?: string;
}

export interface ProtocolError extends DateRange {
  type: "planOverlap" | "shiftOverlap" | "sequenceRegression";
  eventIds: string[];
  message: string;
}

export interface ThreadDeclaration {
  id: string;
  group: string;
  item: string;
  expectedMinutes?: number | null;
  deadline?: Date | null;
  createdAt?: Date | null;
}

export type ThreadSource = "declared" | "auto" | "both";

export type FeasibilityStatus =
  | "fulfilled"
  | "scheduled"
  | "needsScheduling"
  | "tightPace"
  | "imbalanced"
  | "expired"
  | "untracked";

export interface ThreadView {
  key: string;
  group: string;
  item: string;
  source: ThreadSource;
  fulfilledMinutes: number;
  futureMinutes: number;
  externalShiftMinutes: number;
  internalShiftMinutes: number;
  expectedMinutes: number | null;
  deadline: string | null;
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  planCoverageRate: number | null;
  dailyRequiredMinutes: number | null;
  status: FeasibilityStatus;
  canDelete: boolean;
  closed: boolean;
  sequences: number[];
  history: ThreadHistoryEntry[];
}

export interface ThreadGroupView {
  key: string;
  group: string;
  expectedMinutes: number | null;
  deadline: string | null;
  fulfilledMinutes: number;
  futureMinutes: number;
  externalShiftMinutes: number;
  internalShiftMinutes: number;
  factGapMinutes: number | null;
  unscheduledGapMinutes: number | null;
  planCoverageRate: number | null;
  dailyRequiredMinutes: number | null;
  status: FeasibilityStatus;
  items: ThreadView[];
}

export interface ThreadHistoryEntry {
  startAt: string;
  endAt: string;
  kind: string;
  minutes: number;
  title: string;
  source: "fact" | "futurePlan";
}

export interface Note {
  id: string;
  date: string;
  body: string;
  visibility: "private" | "public";
}
