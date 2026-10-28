import type { CSSProperties } from "react";

// 決定的な疑似乱数（SSR とクライアントで同じ配置にする）
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 110 }, (_, i) => {
  const big = rand(i + 500) > 0.9;
  return {
    left: rand(i) * 100,
    top: rand(i + 1000) * 100,
    size: big ? 2 : rand(i + 2000) > 0.6 ? 1.4 : 1,
    dur: 4 + rand(i + 3000) * 6,
    delay: -rand(i + 4000) * 10,
    max: big ? 1 : 0.45 + rand(i + 5000) * 0.4,
  };
});

/** 画面全体の背景: 静かに明滅する星屑 + 淡いオーロラ */
export function StarField() {
  return (
    <div className="night-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="aurora"
        style={{ left: "-10%", top: "-25%", width: "70%", height: "45%", background: "radial-gradient(closest-side, rgba(113,226,239,0.22), transparent)" }}
      />
      <div
        className="aurora"
        style={{ right: "-15%", top: "-10%", width: "60%", height: "40%", background: "radial-gradient(closest-side, rgba(168,130,251,0.2), transparent)", animationDelay: "-9s", animationDuration: "34s" }}
      />
      <div
        className="aurora"
        style={{ left: "25%", bottom: "-30%", width: "60%", height: "40%", background: "radial-gradient(closest-side, rgba(56,99,180,0.22), transparent)", animationDelay: "-17s", animationDuration: "40s" }}
      />
      {STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              "--dur": `${s.dur}s`,
              "--delay": `${s.delay}s`,
              "--max": s.max,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
