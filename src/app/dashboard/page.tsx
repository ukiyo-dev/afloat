import Link from "next/link";

import { DashboardWorkbench } from "@/components/dashboard-workbench";
import { getAuthenticatedOwnerId } from "@/server/services/auth-service";
import {
  loadDashboardData,
  loadLocalVisitorDashboardData,
  type DashboardRangeRequest
} from "@/server/services/dashboard-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<DashboardRangeRequest & { viewAs?: string }>;
}) {
  const isOwner = await getAuthenticatedOwnerId();
  const search = await searchParams;

  // If owner, let them see their full dashboard (unless they explicitly request guest view)
  if (isOwner) {
    if (search.viewAs === "guest") {
      const visitorData = await loadLocalVisitorDashboardData(search);
      if (visitorData) {
        return <DashboardWorkbench {...visitorData} visitorMode isOwner={true} basePath="/dashboard" />;
      }
    }
    const data = await loadDashboardData(search);
    return <DashboardWorkbench {...data} isOwner={true} basePath="/dashboard" />;
  }

  // If visitor mode is enabled, show them the visitor dashboard
  const visitorData = await loadLocalVisitorDashboardData(search);
  if (visitorData) {
    return <DashboardWorkbench {...visitorData} visitorMode isOwner={false} basePath="/dashboard" />;
  }

  // If not owner and visitor mode is OFF, show the locked state
  return (
    <main className="shell flex flex-col items-center justify-center min-h-[80vh] text-center">
      <section className="max-w-2xl relative flex flex-col items-center">
        <p className="font-mono text-highlight bg-ink inline-block px-2 py-1 mb-8 font-bold tracking-widest uppercase text-sm border-2 border-ink">
          SYSTEM LOCKED
        </p>
        <h1 className="font-serif text-5xl md:text-7xl font-black text-ink leading-none tracking-tighter mb-8 uppercase" style={{ fontFeatureSettings: '"opsz" 1' }}>
          ACCESS DENIED<span className="text-highlight drop-shadow-[-2px_-2px_0_#111]">.</span>
        </h1>
        <p className="font-serif text-xl md:text-2xl font-normal text-ink-light mb-12 max-w-xl leading-relaxed text-balance">
          个人计划镜像观察系统。当前环境为私有状态，访客模式尚未开启。
        </p>
        
        <Link href="/login" className="btn-brutal text-2xl py-4 px-12 inline-flex items-center justify-center gap-4 group">
          系统入口
          <span className="bg-ink text-white w-8 h-8 rounded-full flex items-center justify-center text-sm group-hover:bg-highlight group-hover:text-ink transition-colors">→</span>
        </Link>
      </section>
    </main>
  );
}
