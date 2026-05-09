import { recomputeViewsForOwner } from "@/server/services/view-service";
import type { DerivedViews } from "@/server/views/derived-view";

export async function recomputeDerivedViews(ownerId?: string, now = new Date()): Promise<DerivedViews> {
  return recomputeViewsForOwner(ownerId, now);
}
