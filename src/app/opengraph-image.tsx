import { ImageResponse } from "next/og";

// SNS でリンクを共有したときのカード画像（1200×630）。ビルド時に一度だけ描く
export const alt = "マホログ — 日々の学びは、夜空を彩る星となる。";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TAGLINE = "日々の学びは、夜空を彩る星となる。";
const LEAD = "勉強時間が魔力になる、秘術探究の学習記録";

/** Google Fonts から、描く文字だけを含むフォントを取り寄せる（取れなければ既定の書体で描く） */
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  "use cache";
  try {
    const query = `family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    return await (await fetch(src)).arrayBuffer();
  } catch {
    return null;
  }
}

/** 星屑（毎回同じ並びになるよう、簡単な疑似乱数で置く） */
const STARS = (() => {
  let seed = 11;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 70 }, () => ({ x: rand() * 1200, y: rand() * 630, r: 1 + rand() * 2.2, o: 0.2 + rand() * 0.6 }));
})();

export default async function Image() {
  const [mincho, cinzel] = await Promise.all([
    loadFont("Shippori Mincho", 500, `${TAGLINE}${LEAD}魔導録`),
    loadFont("Cinzel", 500, "MAHOLOGArcane Observatory for Knowledge"),
  ]);
  const fonts = [
    ...(mincho ? [{ name: "Mincho", data: mincho, weight: 500 as const, style: "normal" as const }] : []),
    ...(cinzel ? [{ name: "Cinzel", data: cinzel, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "radial-gradient(ellipse at 50% 35%, #1c2546 0%, #0d1326 45%, #080c16 100%)",
          color: "#e9e4d4",
          fontFamily: "Mincho",
        }}
      >
        {STARS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.r,
              height: s.r,
              borderRadius: 9999,
              background: "#fbf3d4",
              opacity: s.o,
            }}
          />
        ))}
        {/* 二重の枠 */}
        <div style={{ position: "absolute", top: 32, left: 32, right: 32, bottom: 32, border: "2px solid rgba(226, 201, 116, 0.55)", display: "flex" }} />
        <div style={{ position: "absolute", top: 44, left: 44, right: 44, bottom: 44, border: "1px solid rgba(226, 201, 116, 0.25)", display: "flex" }} />

        {/* 紋章の魔法陣（アプリのアイコンと同じ図形） */}
        <svg width="132" height="132" viewBox="0 0 48 48">
          <g fill="none" stroke="#e2c974" strokeWidth="1" strokeLinejoin="round">
            <circle cx="24" cy="24" r="22" opacity="0.5" />
            <circle cx="24" cy="24" r="17.5" />
            <polygon points="24,6.5 39.16,32.75 8.84,32.75" />
          </g>
          <circle cx="24" cy="24" r="5" fill="#e2c974" opacity="0.25" />
          <circle cx="24" cy="24" r="2.4" fill="#fff4cf" />
        </svg>

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 18, fontSize: 24, letterSpacing: 14, color: "rgba(226, 201, 116, 0.8)" }}>
          <div style={{ width: 56, height: 1, background: "rgba(226, 201, 116, 0.6)" }} />
          魔導録
          <div style={{ width: 56, height: 1, background: "rgba(226, 201, 116, 0.6)" }} />
        </div>
        <div style={{ marginTop: 6, fontFamily: "Cinzel", fontSize: 104, letterSpacing: 18, color: "#f0dc9a", lineHeight: 1.1 }}>MAHOLOG</div>
        <div style={{ marginTop: 4, fontFamily: "Cinzel", fontSize: 18, letterSpacing: 8, color: "rgba(226, 201, 116, 0.6)" }}>
          Arcane Observatory for Knowledge
        </div>
        <div style={{ marginTop: 40, fontSize: 38, letterSpacing: 10 }}>{TAGLINE}</div>
        <div style={{ marginTop: 14, fontSize: 24, letterSpacing: 6, color: "rgba(233, 228, 212, 0.65)" }}>{LEAD}</div>
      </div>
    ),
    { ...size, fonts },
  );
}
