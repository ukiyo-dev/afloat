import { saveCalendarSourceMapping } from "@/server/services/calendar-source-service";
import { parseCalendarMappingFormData } from "@/server/services/calendar-source-validation";
import { recomputeCurrentOwnerViews } from "@/server/services/view-service";

export async function saveCalendarMappingFromForm(formData: FormData): Promise<void> {
  const { externalCalendarId, name, semantic } = parseCalendarMappingFormData(formData);

  await saveCalendarSourceMapping({
    externalCalendarId,
    name,
    semantic,
    enabled: semantic !== "none"
  });
  await recomputeCurrentOwnerViews();
}
