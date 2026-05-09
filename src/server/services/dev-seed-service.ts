import { seedSampleData } from "@/server/db/seed-sample";
import { recomputeViewsForOwner } from "@/server/services/view-service";

export async function seedSampleAndRecompute(): Promise<{
  ownerId: string;
  seededEvents: number;
  generatedAt: string;
}> {
  const seeded = await seedSampleData();
  const views = await recomputeViewsForOwner(seeded.ownerId);

  return {
    ownerId: seeded.ownerId,
    seededEvents: seeded.events,
    generatedAt: views.private.generatedAt
  };
}
