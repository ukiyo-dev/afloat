import Link from "next/link";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

export default function HomePage() {
  return (
    <main className="shell relative flex min-h-[80vh] flex-col items-center justify-center text-center">
      <a
        href="https://github.com/ukiyo-dev/afloat"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        title="GitHub"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border-2 border-ink bg-paper text-ink transition-colors hover:bg-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:right-6 md:top-6"
      >
        <GitHubLogoIcon className="size-5" aria-hidden="true" />
      </a>

      <section className="max-w-2xl relative flex flex-col items-center">
        <p className="font-mono text-highlight bg-ledger inline-block px-2 py-1 mb-8 font-bold tracking-widest uppercase text-sm border-2 border-ink">
          AFLOAT V1
        </p>
        <h1 className="font-serif text-7xl md:text-9xl font-black text-ink leading-none tracking-tighter mb-8 uppercase" style={{ fontFeatureSettings: '"opsz" 1' }}>
          浮生<span className="text-highlight drop-shadow-[-2px_-2px_0_rgb(var(--color-shadow))]">.</span>
        </h1>
        <p className="font-serif text-xl md:text-2xl font-normal text-ink-light mb-12 max-w-xl leading-relaxed text-balance">
          不安排你的时间，只呈现计划如何成为事实，或如何偏离事实。
        </p>
        
        <Link 
          href="/dashboard"
          prefetch={false}
          className="btn-brutal text-2xl py-4 px-12 inline-flex items-center justify-center gap-4 group"
        >
          进入镜像
          <span className="bg-ledger text-ledger-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm group-hover:bg-highlight group-hover:text-ink-fixed transition-colors">→</span>
        </Link>
      </section>
    </main>
  );
}
