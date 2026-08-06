import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveCalDavCredentialAction } from "@/app/settings/actions";
import type { CalDavCredentialSummary } from "@/server/db/calendar-credentials";

export function CalDavSettingsPanel({ credential }: { credential: CalDavCredentialSummary }) {
  return (
    <section className="panel-brutal bg-surface">
      <div>
        <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Provider</p>
            <h2 className="font-serif text-3xl font-bold">CalDAV 凭证</h2>
          </div>
          <span className="font-mono text-xs px-2 py-1 bg-ledger text-ledger-foreground">
            {calDavCredentialLabel(credential.source)}
          </span>
        </div>

        <ActionForm className="flex flex-col gap-4" action={saveCalDavCredentialAction}>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs font-bold uppercase">Server URL</span>
            <input
              className="input-brutal w-full"
              name="serverUrl"
              type="url"
              defaultValue={credential.serverUrl ?? ""}
              placeholder="https://caldav.example.com"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs font-bold uppercase">Username</span>
            <input
              className="input-brutal w-full"
              name="username"
              defaultValue={credential.username ?? ""}
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
            {credential.configured
              ? "留空密码会保留现有凭证。保存后可在 Mapping 标签页检查连接。"
              : "首次保存 CalDAV 凭证时必须填写 app password / token。"}
          </p>

          <div className="mt-4 flex justify-end">
            <SubmitButton className="btn-brutal" pendingText="SAVING...">保存 CalDAV</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </section>
  );
}

function calDavCredentialLabel(source: CalDavCredentialSummary["source"]): string {
  const labels: Record<CalDavCredentialSummary["source"], string> = {
    database: "DB",
    environment: "ENV",
    none: "NONE"
  };
  return labels[source];
}
