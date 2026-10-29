import type { Rarity } from "@/lib/areas";
import type { Glyph } from "@/lib/items";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

// 各アイテムの幾何学ラインアート（-30〜30 の範囲に収める）
const GLYPHS: Record<Glyph, string> = {
  hourglass:
    "M-14,-25 H14 M-14,25 H14 M-11,-25 L-2,-1 L-11,25 M11,-25 L2,-1 L11,25 M-6,-12 H6 M-5,19 L0,13 L5,19 M0,-1 V10 M-16,-25 V25 M16,-25 V25",
  vial:
    "M-5,-26 H5 M-4,-26 V-13 M4,-26 V-13 M-4,-13 A16,16 0 1,0 4,-13 M-13,7 Q0,1 13,7 M-6,-30 H6 M-4,14 L-2,16 M5,10 L6,12",
  quill:
    "M18,-27 C4,-22 -8,0 -15,25 M18,-27 C14,-10 4,8 -15,25 M18,-27 C6,-14 -4,4 -10,16 M10,-18 L4,-20 M6,-10 L0,-13 M2,-2 L-4,-5 M8,-4 L12,-2 M4,4 L8,7",
  prism:
    "M0,-24 L22,16 L-22,16 Z M0,-24 L0,16 M0,-4 L-22,16 M0,-4 L22,16 M-30,-6 L-10,-2 M10,2 L30,-2 M10,4 L30,6 M10,6 L28,14",
  compass:
    "M0,-22 A22,22 0 1,1 -0.01,-22 M0,-16 L4,0 L0,16 L-4,0 Z M-16,0 L0,4 L16,0 L0,-4 Z M0,-26 V-22 M0,22 V26 M-26,0 H-22 M22,0 H26",
  starmap:
    "M-22,-20 L-8,-22 L4,-18 L20,-22 L22,-6 L18,6 L22,20 L6,22 L-6,18 L-22,22 L-18,6 L-22,-6 Z M-12,-10 L-2,-4 L8,-12 L14,2 M-2,-4 L-6,10 L6,12",
  scroll:
    "M-16,-20 H16 M-16,20 H16 M-16,-20 V20 M16,-20 V20 M-16,-20 A4,4 0 1,1 -20,-16 M16,20 A4,4 0 1,1 20,16 M-10,-10 H10 M-10,-3 H6 M-10,4 H10 M-10,11 H2",
  key:
    "M0,-26 A8,8 0 1,1 -0.01,-26 M0,-18 A2,2 0 1,1 -0.01,-18 M0,-10 V26 M0,14 H8 M0,20 H6 M0,26 H9 M-6,-10 H6",
  leaf:
    "M0,-26 C18,-12 18,12 0,26 C-18,12 -18,-12 0,-26 Z M0,-22 V30 M0,-10 L8,-16 M0,-10 L-8,-16 M0,0 L10,-6 M0,0 L-10,-6 M0,10 L9,4 M0,10 L-9,4",
  crystal:
    "M0,-28 L12,-12 L12,12 L0,28 L-12,12 L-12,-12 Z M0,-28 L4,-10 L0,28 L-4,-10 Z M-12,-12 L-4,-10 M12,-12 L4,-10 M-12,12 L0,28 M12,12 L0,28 M-24,-18 L-20,-14 M22,16 L26,20",
  flame:
    "M0,-26 C14,-10 16,6 8,18 C4,24 -4,24 -8,18 C-16,6 -8,-6 0,-26 Z M0,-8 C6,0 7,8 3,14 C1,17 -1,17 -3,14 C-7,8 -4,2 0,-8 Z M-18,22 H18",
  ring:
    "M-20,6 A20,10 0 1,0 20,6 A20,10 0 1,0 -20,6 M-16,6 A16,7 0 1,0 16,6 A16,7 0 1,0 -16,6 M0,-4 L-8,-14 L0,-26 L8,-14 Z M-8,-14 H8 M0,-26 L-3,-14 L0,-4 L3,-14 Z",
  lantern:
    "M0,-30 A4,4 0 1,1 -0.01,-30 M-8,-22 H8 L12,-16 H-12 Z M-12,-16 V16 M12,-16 V16 M-14,16 H14 L10,22 H-10 Z M0,-16 V16 M0,-6 C5,0 5,6 0,9 C-5,6 -5,0 0,-6 Z",
  feather:
    "M0,-28 C14,-16 14,10 0,22 C-14,10 -14,-16 0,-28 Z M0,-28 V30 M0,-16 L9,-20 M0,-16 L-9,-20 M0,-6 L11,-10 M0,-6 L-11,-10 M0,4 L10,0 M0,4 L-10,0 M0,13 L6,10 M0,13 L-6,10",
  bell:
    "M-16,14 C-16,-4 -12,-18 0,-18 C12,-18 16,-4 16,14 Z M-20,14 H20 M0,14 V20 M0,22 A2,2 0 1,1 -0.01,22 M0,-18 V-24 M0,-26 A2,2 0 1,1 -0.01,-26 M-8,-4 C-6,-10 -2,-12 2,-12",
};

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
 * locked=true（未獲得）は灰色の薄い線で、発光させない。
 */
export function ItemArt({
  glyph,
  rarity,
  color,
  seed,
  locked = false,
  className,
}: {
  glyph: Glyph;
  rarity: Rarity;
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
      style={locked ? { opacity: 0.35 } : { filter: `drop-shadow(0 0 2px ${color}cc) drop-shadow(0 0 6px ${color}55)` }}
      aria-hidden
    >
      {/* 外枠: レア度で紋様が変わる */}
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
      {stars.length > 0 && (
        <g>
          <polyline points={stars.map((p) => p.join(",")).join(" ")} stroke={stroke} strokeOpacity="0.3" {...hairline} />
          {stars.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.9" fill={locked ? stroke : "#f4f1e6"} />
          ))}
        </g>
      )}
      <path d={GLYPHS[glyph]} stroke={stroke} strokeLinecap="round" strokeLinejoin="round" {...hairline} />
      {!locked && <circle r="1" fill="#ffffff" opacity="0.9" />}
    </svg>
  );
}

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
