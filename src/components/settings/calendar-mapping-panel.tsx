import { CalendarMappingForm, type CalendarMappingState } from "@/components/calendar-mapping-form";
import { saveSettingsCalendarMappingAction } from "@/app/settings/actions";

export function CalendarMappingPanel({ calendars }: { calendars: CalendarMappingState }) {
  return (
    <section className="panel-brutal">
      <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Mapping</p>
          <h2 className="font-serif text-3xl font-bold">日历映射</h2>
        </div>
      </div>
      <CalendarMappingForm calendars={calendars} action={saveSettingsCalendarMappingAction} />
    </section>
  );
}
