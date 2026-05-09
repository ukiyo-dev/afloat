import Link from "next/link";
import { getAuthenticatedOwnerId } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const isOwner = await getAuthenticatedOwnerId();

  return (
    <main className="shell flex flex-col items-center justify-center min-h-[80vh] text-center">
      <section className="max-w-2xl relative flex flex-col items-center">
        <p className="font-mono text-highlight bg-ink inline-block px-2 py-1 mb-8 font-bold tracking-widest uppercase text-sm border-2 border-ink">
          AFLOAT V1
        </p>
        <h1 className="font-serif text-7xl md:text-9xl font-black text-ink leading-none tracking-tighter mb-8 uppercase" style={{ fontFeatureSettings: '"opsz" 1' }}>
          浮生<span className="text-highlight drop-shadow-[-2px_-2px_0_#111]">.</span>
        </h1>
        <p className="font-serif text-xl md:text-2xl font-normal text-ink-light mb-12 max-w-xl leading-relaxed text-balance">
          不安排你的时间，只呈现计划如何成为事实，或如何偏离事实。
        </p>
        
        <Link 
          href={isOwner ? "/dashboard" : "/dashboard"} 
          className="btn-brutal text-2xl py-4 px-12 inline-flex items-center justify-center gap-4 group"
        >
          进入镜像
          <span className="bg-ink text-white w-8 h-8 rounded-full flex items-center justify-center text-sm group-hover:bg-highlight group-hover:text-ink transition-colors">→</span>
        </Link>
      </section>
    </main>
  );
}
