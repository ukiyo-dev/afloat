import Link from "next/link";
import { ArrowLeftIcon } from "@radix-ui/react-icons";

import { GeneralSettingsPanel } from "@/components/settings/general-settings-panel";
import { CalDavSettingsPanel } from "@/components/settings/caldav-settings-panel";
import { CalendarMappingPanel } from "@/components/settings/calendar-mapping-panel";
import { WorkbenchTabs, type WorkbenchTab } from "@/components/workbench-tabs";
import { requirePageAuthentication } from "@/server/services/auth-service";
import { loadCurrentCalDavCredentialSummary } from "@/server/services/caldav-credential-service";
import { loadDashboardSettings } from "@/server/services/settings-service";
import { describeDashboardDefaultRange } from "@/server/services/dashboard-range";
import { listCalDavCalendars } from "@/server/services/sync-service";
import type { CalendarMappingState } from "@/components/calendar-mapping-form";

export const dynamic = "force-dynamic";

type SettingsTab = "general" | "provider" | "mapping";

const settingsTabs: readonly WorkbenchTab<SettingsTab>[] = [
  { key: "general", label: "GENERAL" },
  { key: "provider", label: "PROVIDER" },
  { key: "mapping", label: "MAPPING" }
];

function parseSettingsTab(value: string | undefined): SettingsTab {
  return value === "provider" || value === "mapping" ? value : "general";
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePageAuthentication();
  const search = await searchParams;
  const activeTab = parseSettingsTab(search.tab);

  const [settings, calDavCredential, calendars] = await Promise.all([
    loadDashboardSettings(),
    activeTab === "provider" ? loadCurrentCalDavCredentialSummary() : Promise.resolve(null),
    activeTab === "mapping" ? loadCalendarsSafely() : Promise.resolve(null)
  ]);

  return (
    <main className="shell pt-0 md:pt-0">
      <div className="mb-8">
        <WorkbenchTabs
          tabs={settingsTabs}
          activeKey={activeTab}
          basePath="/settings"
          defaultKey="general"
          ariaLabel="Settings tabs"
        />
      </div>

      <section className="mb-12 border-b-4 border-ink pb-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="font-mono text-highlight bg-ledger inline-block px-2 py-1 font-bold tracking-widest text-xs border border-ink uppercase">
              Configuration
            </p>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-black text-ink leading-none tracking-tighter mb-4 uppercase">
            设置
          </h1>
          <p className="font-serif text-xl md:text-2xl font-normal text-ink-light max-w-2xl text-balance">
            配置个人镜像、日历连接和映射。
          </p>
        </div>

        <div className="panel-brutal !p-4 min-w-[240px] flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="block font-mono text-xs text-ink-light mb-1">DEFAULT RANGE</span>
              <strong className="font-mono text-lg block mb-1">
                {describeDashboardDefaultRange(settings.defaultDashboardRange)}
              </strong>
            </div>
          </div>

          <div className="ledger-border-t pt-3 mt-1 flex justify-between items-center">
            <Link href="/dashboard" className="font-mono text-sm font-bold flex items-center gap-1 hover:text-highlight hover:bg-ledger px-2 py-1 -ml-2 transition-colors">
              <ArrowLeftIcon /> DASHBOARD
            </Link>
          </div>
        </div>
      </section>

      {activeTab === "general" ? <GeneralSettingsPanel settings={settings} /> : null}
      {activeTab === "provider" && calDavCredential ? (
        <CalDavSettingsPanel credential={calDavCredential} />
      ) : null}
      {activeTab === "mapping" && calendars ? <CalendarMappingPanel calendars={calendars} /> : null}
    </main>
  );
}

async function loadCalendarsSafely(): Promise<CalendarMappingState> {
  try {
    return await listCalDavCalendars();
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Failed to list CalDAV calendars."
    };
  }
}
