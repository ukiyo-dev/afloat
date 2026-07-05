import "./styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Serif_SC, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { PwaServiceWorker } from "@/components/pwa-service-worker";

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
  description: "Personal Plan Mirror",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Afloat",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" }
    ],
    apple: "/favicon.ico",
    shortcut: "/favicon.ico"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${serif.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("afloat-theme-mode");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}else{document.documentElement.removeAttribute("data-theme")}}catch(e){}`
          }}
        />
      </head>
      <body className="font-mono bg-paper text-ink selection:bg-highlight selection:text-ink min-h-screen border-t-8 border-ink">
        {children}
        <PwaServiceWorker />
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            className: 'font-mono text-sm border-2 border-ink shadow-brutal rounded-none',
            style: {
              background: 'rgb(var(--color-paper))',
              color: 'rgb(var(--color-ink))',
              borderColor: 'rgb(var(--color-ink))',
            }
          }} 
        />
      </body>
    </html>
  );
}
