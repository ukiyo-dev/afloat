import "./styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Serif_SC, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

const serif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "浮生～时间的永恒镜像",
  description: "Personal plan mirror",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${serif.variable} ${mono.variable}`}>
      <body className="font-mono bg-paper text-ink selection:bg-highlight selection:text-ink min-h-screen border-t-8 border-ink">
        {children}
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            className: 'font-mono text-sm border-2 border-ink shadow-[4px_4px_0_0_#111] rounded-none',
            style: {
              background: '#f0ece1',
              color: '#111',
            }
          }} 
        />
      </body>
    </html>
  );
}
