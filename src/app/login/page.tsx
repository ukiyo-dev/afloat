import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@radix-ui/react-icons";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { loginAction } from "@/app/login/actions";
import {
  getAuthenticatedOwnerId,
  isAuthenticationConfigured
} from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAuthenticatedOwnerId()) {
    redirect("/dashboard");
  }

  return (
    <main className="shell flex flex-col justify-center min-h-[80vh]">
      <div className="max-w-md w-full mx-auto">
        <Link href="/" className="font-mono text-sm font-bold flex items-center gap-2 mb-8 hover:text-highlight transition-colors inline-flex border-2 border-transparent hover:border-ink hover:bg-ink hover:px-2 -ml-2 py-1">
          <ArrowLeftIcon /> BACK TO HOME
        </Link>
        
        <section className="mb-8">
          <p className="font-mono text-highlight bg-ink inline-block px-2 py-1 mb-4 font-bold tracking-widest uppercase text-xs border border-ink">
            OWNER MODE
          </p>
          <h1 className="font-serif text-5xl font-black text-ink leading-none tracking-tighter mb-4 uppercase">
            登录
          </h1>
          <p className="font-mono text-sm text-ink-light leading-relaxed">
            输入 owner 密码以查看完整镜像、同步日历和修改设置。
          </p>
        </section>

        <section className="panel-brutal !p-6 md:!p-8 bg-white relative">
          {isAuthenticationConfigured() ? (
            <ActionForm action={loginAction} className="flex flex-col gap-6">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-sm font-bold uppercase tracking-wider">Owner Password</span>
                <input 
                  name="password" 
                  type="password" 
                  autoComplete="current-password" 
                  required 
                  className="input-brutal w-full text-lg"
                  placeholder="••••••••"
                />
              </label>
              <SubmitButton className="btn-brutal w-full py-3 text-lg mt-2" pendingText="AUTHENTICATING..." showMask>
                LOGIN
              </SubmitButton>
            </ActionForm>
          ) : (
            <div className="border-2 border-dashed border-danger/50 p-6 text-center bg-danger/5">
              <p className="font-mono text-sm text-danger font-bold">
                登录尚未配置。请设置 AFLOAT_OWNER_PASSWORD 和 AFLOAT_INSTANCE_SECRET 后重启应用。
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
