/**
 * 書庫の魔法陣の外側: 陣（CelestialBackdrop）の外へ広がる淡い外輪と、札の空に散らばる小さな星。
 * 陣そのものの印象を変えないよう、線も星もごく淡くし、動きは星の明滅だけにする
 */

// 決定的な疑似乱数（SSR とクライアントで同じ配置にする）
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** 札の空の星（%）。陣の重なる中央は避ける */
const STARS = Array.from({ length: 64 }, (_, i) => ({
  left: rand(i + 1) * 100,
  top: rand(i + 101) * 100,
  size: rand(i + 201) < 0.85 ? 1 : 1.6,
  opacity: 0.25 + rand(i + 301) * 0.35,
  delay: -rand(i + 401) * 9,
}))
  .filter((s) => ((s.left - 50) / 30) ** 2 + ((s.top - 50) / 46) ** 2 > 1)
  .slice(0, 34);

/** 外輪に添える菱形の印（陣の頂点と重ならない 8 方位） */
const MARKS = Array.from({ length: 8 }, (_, i) => (i * 45 + 22.5) * (Math.PI / 180));

const hairline = { fill: "none", vectorEffect: "non-scaling-stroke" } as const;

export function RadarField() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="glimmer absolute rounded-full bg-[#f4f1e6]"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: s.opacity, animationDelay: `${s.delay}s` }}
        />
      ))}
      {/* 外輪: 陣の大きさ（短い辺の 84%）に合わせて、その外側に重ねる */}
      <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
        <svg viewBox="-100 -100 200 200" className="h-[min(160cqw,160cqh)] w-[min(160cqw,160cqh)] shrink-0 overflow-visible">
          <circle r="60" stroke="#e2c974" strokeOpacity="0.07" strokeWidth="0.5" {...hairline} />
          <circle r="64" stroke="#e2c974" strokeOpacity="0.1" strokeWidth="0.5" strokeDasharray="0.6 3" {...hairline} />
          <circle r="84" stroke="#a882fb" strokeOpacity="0.06" strokeWidth="0.5" {...hairline} />
          <circle r="96" stroke="#71e2ef" strokeOpacity="0.07" strokeWidth="0.5" strokeDasharray="0.6 4" {...hairline} />
          {MARKS.map((a) => {
            const x = Math.round(Math.cos(a) * 64 * 100) / 100;
            const y = Math.round(Math.sin(a) * 64 * 100) / 100;
            return <path key={a} d={`M${x},${y - 1.6} L${x + 1},${y} L${x},${y + 1.6} L${x - 1},${y} Z`} fill="#e2c974" fillOpacity="0.18" />;
          })}
        </svg>
      </div>
    </div>
  );
}
