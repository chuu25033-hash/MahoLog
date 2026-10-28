import type { Metadata, Viewport } from "next";
import { Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google";
import { Smartphone } from "lucide-react";
import "./globals.css";

const rounded = M_PLUS_Rounded_1c({
  variable: "--font-sans",
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "マホログ",
  description: "勉強時間を魔力に変えて、大魔法使いを目指す学習記録アプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b1530",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`dark ${rounded.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="starry-bg h-dvh overflow-hidden">
        {children}
        <div className="rotate-hint fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <Smartphone className="size-12 rotate-90 text-primary" />
          <p className="text-lg font-bold">端末を横向きにしてください</p>
          <p className="text-sm text-muted-foreground">マホログは横画面に最適化されています</p>
        </div>
      </body>
    </html>
  );
}
