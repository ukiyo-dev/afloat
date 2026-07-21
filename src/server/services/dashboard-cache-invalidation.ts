import { revalidateTag } from "next/cache";

export type DashboardCacheDomain = "view" | "settings" | "rules" | "sync";

export function dashboardCacheTag(ownerId: string, domain: DashboardCacheDomain): string {
  return `dashboard:${ownerId}:${domain}`;
}

export function invalidateDashboardCache(ownerId: string, ...domains: DashboardCacheDomain[]): void {
  for (const domain of domains) {
    revalidateTag(dashboardCacheTag(ownerId, domain), { expire: 0 });
  }
}
