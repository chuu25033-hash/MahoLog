import type { Metadata, Viewport } from "next";
import { Cinzel, Geist_Mono, Shippori_Mincho } from "next/font/google";
import { Smartphone } from "lucide-react";
import { ChapterThemeSync } from "@/components/chapter-theme-sync";
import { CloudSyncStarter } from "@/components/cloud-sync-starter";
import { LiteModeSync } from "@/components/lite-mode-sync";
import { SiteAnalytics } from "@/components/site-analytics";
import { SoundSync } from "@/components/sound-sync";
import { StarField } from "@/components/star-field";
import { TransitionVeil } from "@/components/transition-veil";
import { ViewportAnchor } from "@/components/viewport-anchor";
import "./globals.css";

const mincho = Shippori_Mincho({
  variable: "--font-mincho",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  preload: false,
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅の記録";

/** 共有カードの画像などを絶対 URL にする基準。NEXT_PUBLIC_SITE_URL が無ければ Vercel の本番ドメインを使う */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "マホログ",
  description: DESCRIPTION,
  applicationName: "マホログ",
  // SNS で共有したときのカード（画像は app/opengraph-image.tsx）
  openGraph: { type: "website", siteName: "マホログ", title: "マホログ", description: DESCRIPTION, locale: "ja_JP", url: "/" },
  twitter: { card: "summary_large_image", title: "マホログ", description: DESCRIPTION },
  // iPhone / iPad でホーム画面に追加したとき、ブラウザの枠なしで開く
  appleWebApp: { capable: true, title: "マホログ", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080c16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`dark ${mincho.variable} ${cinzel.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="safe-area h-dvh overflow-hidden bg-midnight">
        <StarField />
        <LiteModeSync />
        <ChapterThemeSync />
        <CloudSyncStarter />
        <ViewportAnchor />
        <SoundSync />
        {children}
        <TransitionVeil />
        <SiteAnalytics />
        {/* スマホは縦持ち専用。横にしたときだけ縦向きを促す（iPhone は向きを固定できないため） */}
        <div className="rotate-hint night-sky fixed inset-0 z-[100] flex-col items-center justify-center gap-4 p-8 text-center">
          <Smartphone className="size-10 text-starlight" strokeWidth={1.25} />
          <p className="text-lg tracking-widest">端末を縦向きにしてください</p>
          <p className="text-sm text-muted-foreground">スマホでは縦画面で詠唱します</p>
        </div>
      </body>
    </html>
  );
}
