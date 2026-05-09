import { DashboardData } from "@/server/services/dashboard-service";
import { ActionForm } from "../action-form";
import { SubmitButton } from "../submit-button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { runRecentSyncAction, runRecalibrateAction, recomputeViewsAction } from "../../app/dashboard/actions";
import { formatGeneratedAt } from "../view-formatters";

export function SyncPanel({
  latestSyncRun,
  timezone,
  readOnly = false
}: Pick<DashboardData, "latestSyncRun"> & { timezone: string; readOnly?: boolean }) {
  return (
    <section className="panel-brutal flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4 border-b-2 border-ink pb-2">
          <div>
            <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">System</p>
            <h2 className="font-serif text-2xl font-bold">日历同步</h2>
          </div>
        </div>
        
        {latestSyncRun ? (
          <div className="flex flex-col gap-2 mb-6 font-mono text-sm">
            <div className="flex justify-between items-center border-b border-dashed border-ink/20 pb-2">
              <span className="text-ink-light">Last Sync</span>
              <span className="font-bold">{formatGeneratedAt(latestSyncRun.startedAt, timezone)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-light">Status</span>
              <span className={`font-bold px-2 py-0.5 text-xs border ${
                latestSyncRun.status === 'failed' ? 'bg-danger text-white border-danger' : 
                latestSyncRun.status === 'running' ? 'bg-highlight text-ink border-ink' : 
                'bg-ink text-white border-ink'
              }`}>
                {latestSyncRun.status.toUpperCase()}
              </span>
            </div>
            {latestSyncRun.errorMessage ? (
              <div className="mt-2 text-xs text-danger bg-danger/5 p-2 border-l-2 border-danger break-words">
                {latestSyncRun.errorMessage}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="font-mono text-ink-light text-sm italic mb-6">尚无同步记录。</p>
        )}
      </div>

      {readOnly ? null : (
        <div className="flex flex-col gap-2 pt-4 border-t-2 border-ink">
          <ActionForm action={runRecentSyncAction}>
            <SubmitButton className="btn-brutal w-full flex items-center justify-center gap-2" pendingText="SYNCING..." showMask>
              <ReloadIcon /> 立即同步 (SYNC)
            </SubmitButton>
          </ActionForm>
          
          <details className="group/adv mt-2">
            <summary className="font-mono text-[10px] text-ink-light cursor-pointer hover:text-ink select-none text-center">
              ADVANCED OPTIONS <span className="inline-block group-open/adv:rotate-180">▼</span>
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <ActionForm action={runRecalibrateAction}>
                <SubmitButton className="btn-brutal w-full text-[10px] px-1 py-1" pendingText="CALIBRATING..." showMask>重新校准全量</SubmitButton>
              </ActionForm>
              <ActionForm action={recomputeViewsAction}>
                <SubmitButton className="btn-brutal w-full text-[10px] px-1 py-1" pendingText="COMPUTING..." showMask>重算所有视图</SubmitButton>
              </ActionForm>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
