"use client";

import { useFormStatus } from "react-dom";
import { UpdateIcon } from "@radix-ui/react-icons";

export function SubmitButton({
  children,
  className = "",
  pendingText = "PROCESSING...",
  showMask = false,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  showMask?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      {showMask && pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm">
          <div className="panel-brutal !py-8 !px-12 flex flex-col items-center gap-6 border-4 border-ink shadow-[12px_12px_0_0_#111] bg-highlight">
            <UpdateIcon className="w-12 h-12 text-ink animate-spin" />
            <p className="font-mono text-xl font-black text-ink tracking-widest uppercase animate-pulse">
              {pendingText}
            </p>
          </div>
        </div>
      )}
      <button 
        className={`${className} ${pending ? "opacity-50 cursor-not-allowed" : ""}`} 
        type="submit" 
        disabled={pending}
      >
        {pending ? (
          <span className="flex items-center gap-2 justify-center w-full">
            <UpdateIcon className="animate-spin" /> {showMask ? children : pendingText}
          </span>
        ) : (
          children
        )}
      </button>
    </>
  );
}
