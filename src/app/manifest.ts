import type { MetadataRoute } from "next";

/** ホーム画面に追加して、アプリのように横画面いっぱいで開く */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "マホログ",
    short_name: "マホログ",
    description: "孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅の記録",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "landscape",
    background_color: "#080c16",
    theme_color: "#080c16",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
