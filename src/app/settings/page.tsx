import Link from "next/link";
import { ArrowLeftIcon } from "@radix-ui/react-icons";

import { SubmitButton } from "@/components/submit-button";
import { ActionForm } from "@/components/action-form";
import {
  saveCalDavCredentialAction,
  saveSettingsAction,
  saveSettingsCalendarMappingAction
} from "@/app/settings/actions";
import { CalendarMappingForm } from "@/components/calendar-mapping-form";
import { requirePageAuthentication } from "@/server/services/auth-service";
import { loadCurrentCalDavCredentialSummary } from "@/server/services/caldav-credential-service";
import { loadDashboardSettings } from "@/server/services/settings-service";
import { describeDashboardDefaultRange } from "@/server/services/dashboard-range";
import { listCalDavCalendars } from "@/server/services/sync-service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageAuthentication();
  const [settings, calendars, calDavCredential] = await Promise.all([
    loadDashboardSettings(),
    loadCalendarsSafely(),
    loadCurrentCalDavCredentialSummary()
  ]);

  return (
    <main className="shell">
      <section className="mb-12 border-b-4 border-ink pb-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <p className="font-mono text-highlight bg-ink inline-block px-2 py-1 font-bold tracking-widest text-xs border border-ink uppercase">
              Configuration
            </p>
          </div>
          
          <h1 className="font-serif text-5xl md:text-7xl font-black text-ink leading-none tracking-tighter mb-4 uppercase">
            设置
          </h1>
          <p className="font-serif text-xl md:text-2xl font-normal text-ink-light max-w-2xl text-balance">
            配置日历映射和 CalDAV 凭证。
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
            <Link href="/dashboard" className="font-mono text-sm font-bold flex items-center gap-1 hover:text-highlight hover:bg-ink px-2 py-1 -ml-2 transition-colors">
              <ArrowLeftIcon /> DASHBOARD
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section className="panel-brutal flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4">
              <div>
                <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">General</p>
                <h2 className="font-serif text-3xl font-bold">通用设置</h2>
              </div>
            </div>
            
            <ActionForm className="flex flex-col gap-4" action={saveSettingsAction}>
              <fieldset className="flex flex-col gap-3">
                <legend className="font-mono text-xs font-bold uppercase mb-1">默认主视图</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-bold uppercase">开始：当前 xday</span>
                    <input
                      className="input-brutal w-full"
                      name="defaultDashboardStartOffset"
                      type="number"
                      step="1"
                      defaultValue={settings.defaultDashboardRange.startOffsetDays}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-bold uppercase">结束：当前 xday</span>
                    <input
                      className="input-brutal w-full"
                      name="defaultDashboardEndOffset"
                      type="number"
                      step="1"
                      defaultValue={settings.defaultDashboardRange.endOffsetDays}
                    />
                  </label>
                </div>
                <p className="font-mono text-xs text-ink-light italic">
                  昨天 = -1 / -1，今天 = 0 / 0，明天 = +1 / +1，最近 7 天 = -7 / -1。
                </p>
              </fieldset>
              
              <label className="flex flex-col gap-1 relative">
                <span className="font-mono text-xs font-bold uppercase">视图时区</span>
                <div className="relative w-full">
                  <select
                    className="input-brutal w-full appearance-none pr-8 cursor-pointer"
                    name="timezone"
                    defaultValue={settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                  >
                    {Intl.supportedValuesOf("timeZone").map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-ink">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-white border border-ink mt-2 cursor-pointer hover:bg-highlight/10 transition-colors">
                <input
                  className="w-5 h-5 accent-ink"
                  name="publicPageEnabled"
                  type="checkbox"
                  defaultChecked={settings.publicPageEnabled}
                />
                <span className="font-mono text-sm font-bold">启用访客模式 (Public Mode)</span>
              </label>
              <p className="font-mono text-xs text-ink-light italic">访客模式启用后，未登录访问将能看到公开镜像。</p>
              
              <div className="mt-4 flex justify-end">
                <SubmitButton className="btn-brutal" pendingText="SAVING...">保存设置</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>

        <section className="panel-brutal bg-white flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4">
              <div>
                <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Provider</p>
                <h2 className="font-serif text-3xl font-bold">CalDAV 凭证</h2>
              </div>
              <span className="font-mono text-xs px-2 py-1 bg-ink text-white">
                {calDavCredentialLabel(calDavCredential.source)}
              </span>
            </div>
            
            <ActionForm className="flex flex-col gap-4" action={saveCalDavCredentialAction}>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">Server URL</span>
                <input
                  className="input-brutal w-full"
                  name="serverUrl"
                  type="url"
                  defaultValue={calDavCredential.serverUrl ?? ""}
                  placeholder="https://caldav.example.com"
                  required
                />
              </label>
              
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">Username</span>
                <input
                  className="input-brutal w-full"
                  name="username"
                  defaultValue={calDavCredential.username ?? ""}
                  autoComplete="username"
                  required
                />
              </label>
              
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold uppercase">App Password / Token</span>
                <input 
                  className="input-brutal w-full" 
                  name="password" 
                  type="password" 
                  autoComplete="new-password" 
                  placeholder="••••••••••••"
                />
              </label>
              
              <p className="font-mono text-xs text-ink-light bg-paper p-2 border border-ink/20 mt-2">
                {calDavCredential.configured
                  ? "留空密码会保留现有凭证。保存后可在下方日历映射区检查连接。"
                  : "首次保存 CalDAV 凭证时必须填写 app password / token。"}
              </p>

              <div className="mt-4 flex justify-end">
                <SubmitButton className="btn-brutal" pendingText="SAVING...">保存 CalDAV</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
      </div>

      <section className="panel-brutal">
        <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Mapping</p>
            <h2 className="font-serif text-3xl font-bold">日历映射</h2>
          </div>
        </div>
        <CalendarMappingForm calendars={calendars} action={saveSettingsCalendarMappingAction} />
      </section>
    </main>
  );
}

function calDavCredentialLabel(source: string): string {
  const labels: Record<string, string> = {
    database: "DB",
    environment: "ENV",
    none: "NONE"
  };
  return labels[source] ?? source;
}

async function loadCalendarsSafely() {
  try {
    return await listCalDavCalendars();
  } catch (error) {
    return {
      status: "failed" as const,
      message: error instanceof Error ? error.message : "Failed to list CalDAV calendars."
    };
  }
}
