"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UpdateIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";

export interface WorkbenchTab<TKey extends string = string> {
  key: TKey;
  label: string;
}

export function WorkbenchTabs<TKey extends string>({
  tabs,
  activeKey,
  basePath,
  defaultKey,
  onSelect,
  ariaLabel = "Workbench tabs"
}: {
  tabs: readonly WorkbenchTab<TKey>[];
  activeKey: TKey;
  basePath: string;
  defaultKey?: TKey;
  onSelect?: (key: TKey) => void;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fallbackKey = defaultKey ?? tabs[0]?.key;
  const [pendingKey, setPendingKey] = useState<TKey | null>(null);

  useEffect(() => {
    if (pendingKey !== null && pendingKey === activeKey) {
      setPendingKey(null);
    }
  }, [activeKey, pendingKey]);

  const selectTab = (key: TKey) => {
    if (key === activeKey && pendingKey === null) {
      return;
    }

    setPendingKey(key);
    if (onSelect) {
      onSelect(key);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (key === fallbackKey) {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${basePath}?${queryString}` : basePath, { scroll: false });
  };

  return (
    <nav className="flex flex-wrap items-start justify-end" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={activeKey === tab.key}
          aria-busy={pendingKey === tab.key}
          aria-label={pendingKey === tab.key ? `${tab.label} loading` : tab.label}
          onClick={() => selectTab(tab.key)}
          className={`workbench-bookmark -ml-3 first:ml-0 min-w-[104px] px-3 py-1.5 text-center font-mono text-xs font-black tracking-widest transition-colors ${
            activeKey === tab.key
              ? "[--bookmark-bg:rgb(var(--color-ledger))] [--bookmark-fg:rgb(var(--color-highlight))]"
              : "[--bookmark-bg:rgb(var(--color-paper))] [--bookmark-fg:rgb(var(--color-ink))] hover:[--bookmark-bg:rgb(var(--color-highlight))] hover:[--bookmark-fg:rgb(var(--color-ink-fixed))]"
          }`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            {tab.label}
            {pendingKey === tab.key ? <UpdateIcon className="h-3 w-3 animate-spin" aria-hidden /> : null}
          </span>
        </button>
      ))}
    </nav>
  );
}
