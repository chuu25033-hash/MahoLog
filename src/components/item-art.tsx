import type { ItemRarity } from "@/lib/items";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

// 決定的な疑似乱数
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function hash(text: string) {
  return [...text].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 100_000, 7);
}

/** アイテムごとに固有の星座（伝承の品の背景） */
function constellation(seed: string) {
  const h = hash(seed);
  return Array.from({ length: 5 }, (_, i) => {
    const angle = rand(h + i) * Math.PI * 2;
    const r = 30 + rand(h + i + 50) * 8;
    return [Math.cos(angle) * r, Math.sin(angle) * r] as const;
  }).sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
}

/**
 * 1px の極細線で描く幾何学ラインアート。
 * locked=true（未所持）は輪郭だけが闇に沈んだシルエットで描き、発光させない。
 */
export function ItemArt({
  icon,
  rarity,
  color,
  seed,
  locked = false,
  className,
}: {
  /** svgIcon（SVG パス） */
  icon: string;
  rarity: ItemRarity;
  color: string;
  seed: string;
  locked?: boolean;
  className?: string;
}) {
  const stroke = locked ? "#64748b" : color;
  const stars = rarity === "B" ? constellation(seed) : [];

  return (
    <svg
      viewBox="-50 -50 100 100"
      className={cn("overflow-visible", className)}
      style={locked ? undefined : { filter: `drop-shadow(0 0 2px ${color}cc) drop-shadow(0 0 6px ${color}55)` }}
      aria-hidden
    >
      {/* 外枠: レア度で紋様が変わる */}
      <g opacity={locked ? 0.3 : 1}>
        <circle r="44" stroke={stroke} strokeOpacity="0.35" {...hairline} />
        <circle r="40" stroke={stroke} strokeOpacity="0.25" strokeDasharray="1 3" {...hairline} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line key={deg} y1="-44" y2={deg % 90 === 0 ? -48 : -46} stroke={stroke} strokeOpacity="0.5" transform={`rotate(${deg})`} {...hairline} />
        ))}
        {rarity === "B" && (
          <rect x="-31" y="-31" width="62" height="62" stroke={stroke} strokeOpacity="0.18" transform="rotate(45)" {...hairline} />
        )}
        {rarity === "A" && (
          <g stroke={stroke} strokeOpacity="0.22">
            <polygon points="0,-40 34.6,20 -34.6,20" {...hairline} />
            <polygon points="0,40 34.6,-20 -34.6,-20" {...hairline} />
          </g>
        )}
        {(rarity === "S" || rarity === "SS") && (
          // 至宝: 八芒星 {8/3} と外周の二重環
          <g stroke={stroke}>
            <circle r="47" strokeOpacity="0.3" {...hairline} />
            <polygon points={OCTAGRAM} strokeOpacity="0.24" {...hairline} />
            {[0, 90, 180, 270].map((deg) => (
              <polygon key={deg} points="0,-52 1.6,-48.5 0,-45 -1.6,-48.5" strokeOpacity="0.6" transform={`rotate(${deg})`} {...hairline} />
            ))}
          </g>
        )}
        {rarity === "SS" && (
          // 神話: 至宝の紋様に、ずらした八芒星と十二の星の刻みを重ねる
          <g stroke={stroke}>
            <circle r="51" strokeOpacity="0.25" strokeDasharray="1 2" {...hairline} />
            <polygon points={OCTAGRAM} strokeOpacity="0.2" transform="rotate(22.5)" {...hairline} />
            {Array.from({ length: 12 }, (_, i) => (
              <circle key={i} cy="-51" r="0.8" fill={stroke} stroke="none" transform={`rotate(${i * 30})`} />
            ))}
          </g>
        )}
        {stars.length > 0 && (
          <g>
            <polyline points={stars.map((p) => p.join(",")).join(" ")} stroke={stroke} strokeOpacity="0.3" {...hairline} />
            {stars.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="0.9" fill={locked ? stroke : "#f4f1e6"} />
            ))}
          </g>
        )}
      </g>
      {locked ? (
        // 未所持: 太い影で形だけを浮かべ、細い輪郭を淡く重ねる
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={icon} stroke="#05070c" strokeOpacity="0.9" strokeWidth="5" />
          <path d={icon} stroke="#475569" strokeOpacity="0.35" {...hairline} />
        </g>
      ) : (
        <>
          <path d={icon} stroke={stroke} strokeLinecap="round" strokeLinejoin="round" {...hairline} />
          <circle r="1" fill="#ffffff" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

/** 八芒星 {8/3}（半径 38） */
const OCTAGRAM = Array.from({ length: 8 }, (_, i) => {
  const angle = ((-90 + ((i * 3) % 8) * 45) * Math.PI) / 180;
  return `${(Math.cos(angle) * 38).toFixed(2)},${(Math.sin(angle) * 38).toFixed(2)}`;
}).join(" ");

/** ドロップ演出の宝箱（open で蓋が開き、光が溢れる） */
export function TreasureChest({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="-50 -50 100 100"
      className={cn("overflow-visible", className)}
      style={{ filter: "drop-shadow(0 0 2px #e2c974cc) drop-shadow(0 0 8px #e2c97455)" }}
      aria-hidden
    >
      {/* 開いた瞬間に放射する光線 */}
      <g
        className="transition-opacity duration-700"
        style={{ opacity: open ? 1 : 0 }}
        stroke="#fbf3d4"
        strokeOpacity="0.6"
      >
        {[-60, -40, -20, 0, 20, 40, 60].map((deg) => (
          <line key={deg} y1="-6" y2="-40" transform={`rotate(${deg} 0 -4)`} {...hairline} />
        ))}
      </g>
      {/* 本体 */}
      <g stroke="#e2c974">
        <path d="M-26,-4 H26 V24 H-26 Z" {...hairline} />
        <path d="M-26,4 H26 M-14,-4 V24 M14,-4 V24" strokeOpacity="0.5" {...hairline} />
        <path d="M-4,-4 V6 H4 V-4 M0,1 V3" {...hairline} />
      </g>
      {/* 蓋: 左奥の蝶番を支点に開く */}
      <g
        stroke="#e2c974"
        className="transition-transform duration-700 ease-out"
        style={{ transformBox: "view-box", transformOrigin: "-26px -4px", transform: open ? "rotate(-28deg)" : "rotate(0deg)" }}
      >
        <path d="M-26,-4 V-12 Q0,-26 26,-12 V-4 Z" {...hairline} />
        <path d="M-14,-4 V-17 M14,-4 V-17" strokeOpacity="0.5" {...hairline} />
      </g>
    </svg>
  );
}
