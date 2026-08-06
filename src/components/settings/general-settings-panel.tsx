import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveSettingsAction } from "@/app/settings/actions";
import type { DashboardSettingsInput } from "@/server/services/settings-service";

export function GeneralSettingsPanel({ settings }: { settings: DashboardSettingsInput }) {
  return (
    <section className="panel-brutal">
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
              昨天 = -1 / -1，今天 = 0 / 0，明天 = +1 / +1，7 天 = -7 / -1。
            </p>
          </fieldset>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 relative">
              <span className="font-mono text-xs font-bold uppercase">视图时区</span>
              <div className="relative w-full">
                <select
                  className="input-brutal w-full appearance-none pr-8 cursor-pointer"
                  name="timezone"
                  defaultValue={settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                >
                  {Intl.supportedValuesOf("timeZone").map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-ink">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs font-bold uppercase">Thread 无活动阈值 / days</span>
              <input
                className="input-brutal w-full"
                name="threadStaleDays"
                type="number"
                min="1"
                step="1"
                defaultValue={settings.threadStaleDays}
              />
            </label>
          </div>
          <p className="font-mono text-xs text-ink-light italic">
            无 Deadline 的 Item 超过该天数没有事实活动后自动休眠；有 Deadline 时在此前标记为需要关注，并以 Deadline 作为最早休眠基准。默认 7 天。
          </p>

          <label className="flex items-center gap-3 p-3 bg-surface border border-ink mt-2 cursor-pointer hover:bg-highlight/10 transition-colors">
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
  );
}
