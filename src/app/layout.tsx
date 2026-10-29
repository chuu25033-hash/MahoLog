import type { Metadata, Viewport } from "next";
import { Cinzel, Geist_Mono, Shippori_Mincho } from "next/font/google";
import { Smartphone } from "lucide-react";
import { StarField } from "@/components/star-field";
import { TransitionVeil } from "@/components/transition-veil";
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

export const metadata: Metadata = {
  title: "マホログ",
  description: "孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅の記録",
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
      <body className="h-dvh overflow-hidden bg-midnight">
        <StarField />
        {children}
        <TransitionVeil />
        <div className="rotate-hint night-sky fixed inset-0 z-[100] flex-col items-center justify-center gap-4 p-8 text-center">
          <Smartphone className="size-10 rotate-90 text-starlight" strokeWidth={1.25} />
          <p className="text-lg tracking-widest">端末を横向きにしてください</p>
          <p className="text-sm text-muted-foreground">マホログは横画面に最適化されています</p>
        </div>
      </body>
    </html>
  );
}
