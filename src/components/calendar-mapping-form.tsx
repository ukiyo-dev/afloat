import { ActionForm } from "@/components/action-form";
import { kindLabel } from "@/components/view-formatters";
import { SEMANTIC_OPTIONS } from "@/server/services/calendar-source-validation";
import type { DiscoveredCalendar } from "@/server/services/sync-service";

export type CalendarMappingState =
  | { status: "succeeded"; calendars: DiscoveredCalendar[] }
  | { status: "not_configured"; message: string }
  | { status: "failed"; message: string };

export function CalendarMappingForm({
  calendars,
  action
}: {
  calendars: CalendarMappingState;
  action: (formData: FormData) => Promise<void>;
}) {
  if (calendars.status !== "succeeded") {
    return (
      <div className="border-2 border-dashed border-ink/20 p-8 text-center bg-paper/50">
        <p className="font-mono text-ink-light text-sm italic">{calendars.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {calendars.calendars.map((calendar) => (
        <ActionForm
          className="panel-brutal !p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:bg-highlight/5 transition-colors" 
          action={action} 
          key={calendar.id}
        >
          <input type="hidden" name="externalCalendarId" value={calendar.id} />
          <input type="hidden" name="name" value={calendar.name} />
          
          <div className="flex-1 min-w-[200px]">
            <strong className="font-serif text-xl block mb-1">{calendar.name}</strong>
            <span className="font-mono text-xs px-2 py-0.5 bg-ink text-white uppercase inline-block">
              {calendar.mapped && calendar.enabled
                ? kindLabel(calendar.semantic ?? "")
                : "UNMAPPED"}
            </span>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <select
              className="input-brutal text-sm py-2 min-w-[160px]"
              name="semantic"
              defaultValue={calendar.mapped && calendar.enabled ? calendar.semantic ?? "ideal" : "none"}
            >
              <option value="none">不关联</option>
              {SEMANTIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="btn-brutal py-2 whitespace-nowrap" type="submit">
              保存映射
            </button>
          </div>
        </ActionForm>
      ))}
    </div>
  );
}
