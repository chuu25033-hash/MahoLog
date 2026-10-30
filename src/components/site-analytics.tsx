"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Analytics（Cookie を使わない訪問数の計測）。Vercel の画面で Analytics を有効にすると集計が始まる。
 * ログインの戻り（?code=…）などを送らないよう、URL のクエリは外してから送る
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.search = "";
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
