import type { CSSProperties } from "react";

/** 拡大縮小しても 1px 以下を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none" } as const;

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** 経線: 球を横から見た楕円（rx を変えて奥行きを出す） */
const MERIDIANS = [96, 78, 52, 22];
/** 緯線: 上下に平行な弦 [y, 半幅] */
const PARALLELS = [-60, -32, 32, 60].map((y) => [y, Math.sqrt(100 * 100 - y * y)] as const);

/** 天球儀の 3D リング: [rotateX, rotateY, 不透明度] */
const RINGS = [
  [0, 0, 0.32],
  [0, 60, 0.22],
  [0, 120, 0.22],
  [72, 0, 0.2],
] as const;

/**
 * タイトル画面中央の天球儀。外周の目盛り環・経緯線の球・3D リングが
 * それぞれ異なる速度でかすかに回転する。
 */
export function CelestialSphere({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="relative aspect-square h-full">
        {/* 外周: 目盛りと時刻のローマ数字 */}
        <svg viewBox="-120 -120 240 240" className="absolute inset-0 h-full w-full animate-[spin_180s_linear_infinite]">
          <circle r="118" stroke="#e2c974" strokeOpacity="0.18" strokeWidth="0.6" {...hairline} />
          <circle r="112" stroke="#e2c974" strokeOpacity="0.3" strokeWidth="0.6" {...hairline} />
          {TICKS.map((deg) => (
            <line
              key={deg}
              x1="0"
              y1={deg % 30 === 0 ? -118 : -115}
              x2="0"
              y2="-112"
              stroke="#e2c974"
              strokeOpacity={deg % 30 === 0 ? 0.45 : 0.2}
              strokeWidth="0.6"
              transform={`rotate(${deg})`}
              {...hairline}
            />
          ))}
          {NUMERALS.map((n, i) => (
            <text
              key={n}
              y="-102"
              transform={`rotate(${i * 30})`}
              textAnchor="middle"
              fontSize="5.5"
              letterSpacing="0.6"
              fill="#e2c974"
              fillOpacity="0.4"
              className="font-display"
            >
              {n}
            </text>
          ))}
          <circle r="96" stroke="#71e2ef" strokeOpacity="0.14" strokeWidth="0.6" strokeDasharray="1 4" {...hairline} />
        </svg>

        {/* 球: 経線・緯線（逆回転） */}
        <svg
          viewBox="-120 -120 240 240"
          className="absolute inset-[10%] h-[80%] w-[80%] animate-[spin_240s_linear_infinite_reverse]"
        >
          <g className="glimmer-slow" transform="rotate(-23.4)">
            <circle r="100" stroke="#cfe9ff" strokeOpacity="0.28" strokeWidth="0.7" {...hairline} />
            {MERIDIANS.map((rx) => (
              <ellipse key={rx} rx={rx} ry="100" stroke="#71e2ef" strokeOpacity="0.16" strokeWidth="0.6" {...hairline} />
            ))}
            <line x1="0" y1="-100" x2="0" y2="100" stroke="#71e2ef" strokeOpacity="0.16" strokeWidth="0.6" {...hairline} />
            {PARALLELS.map(([y, w]) => (
              <ellipse key={y} cy={y} rx={w} ry={w * 0.14} stroke="#71e2ef" strokeOpacity="0.12" strokeWidth="0.6" {...hairline} />
            ))}
            <ellipse rx="100" ry="14" stroke="#e2c974" strokeOpacity="0.32" strokeWidth="0.7" {...hairline} />
            {/* 黄道 */}
            <ellipse rx="100" ry="30" stroke="#a882fb" strokeOpacity="0.3" strokeWidth="0.6" transform="rotate(23.4)" {...hairline} />
            <circle cx="96" cy="-9" r="1.4" fill="#f4f1e6" transform="rotate(23.4)" />
            <circle cy="-100" r="1.6" fill="#e2c974" />
            <circle cy="100" r="1.2" fill="#e2c974" fillOpacity="0.6" />
          </g>
        </svg>

        {/* 中心: 3D に傾いたリング */}
        <div className="armillary inset-[30%]!" style={{ "--ring-color": "#e2c974" } as CSSProperties}>
          <div className="armillary-gimbal [animation-duration:120s]!">
            {RINGS.map(([x, y, opacity], i) => (
              <div key={i} className="armillary-ring" style={{ transform: `rotateY(${y}deg) rotateX(${x}deg)`, opacity }} />
            ))}
          </div>
          <div className="absolute inset-[42%] rounded-full bg-[radial-gradient(circle,#fff8dc,rgba(226,201,116,0.5)_40%,transparent_70%)] opacity-60 blur-[2px]" />
        </div>
      </div>
    </div>
  );
}
