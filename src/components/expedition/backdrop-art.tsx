import type { ReactNode } from "react";
import type { ExpeditionArt, ExpeditionSource } from "@/lib/expedition";

/**
 * 探索の景色の層に描く影絵。どれも左右の端で途切れないよう、絵柄を枠の内側に収めてあり、
 * 横に並べると継ぎ目なく続く。影絵は currentColor（層の色）で塗り、灯や熾火だけ accent の色を差す。
 * 新しい絵は ART に足し、lib/expedition.ts の ExpeditionArt に名前を加える
 */
type Art = { width: number; height: number; render: (accent: string) => ReactNode };

/** 決定的な疑似乱数（SSR とクライアントで同じ絵にする） */
const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** 色ごとのグラデーションの id */
const gradId = (name: string, color: string) => `expedition-${name}-${color.replace(/[^0-9a-z]/gi, "")}`;

/**
 * 聖堂の壁: 柱の間に、灯のともる尖頭窓。窓は透かし彫り（中央の縦桟・小さな尖頭アーチ・円窓）と鉛の桟で区切り、
 * 光は上ほど強い。柱には柱頭と台座を付ける
 */
const CATHEDRAL_BAYS = [90, 270];
function cathedral(accent: string) {
  const id = gradId("window", accent);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.62" />
          <stop offset="0.5" stopColor={accent} stopOpacity="0.26" />
          <stop offset="1" stopColor={accent} stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff8e6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
        </radialGradient>
        {/* 古い硝子の菱形の鉛格子 */}
        <pattern id={`${id}-lattice`} width="9" height="13" patternUnits="userSpaceOnUse">
          <path d="M0,6.5 L4.5,0 L9,6.5 L4.5,13 Z" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={360} height={240} />
      {CATHEDRAL_BAYS.map((cx) => (
        <g key={cx}>
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`} fill={`url(#${id})`} />
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`} fill={`url(#${id}-halo)`} />
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`} fill={`url(#${id}-lattice)`} opacity={0.55} />
          {/* 透かし彫り */}
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d={`M${cx},74 V214 M${cx - 34},150 H${cx + 34}`} strokeWidth={3.2} />
            <path d={`M${cx - 34},128 Q${cx - 33},96 ${cx - 17},86 Q${cx - 1},96 ${cx},128 M${cx},128 Q${cx + 1},96 ${cx + 17},86 Q${cx + 33},96 ${cx + 34},128`} strokeWidth={2.6} />
            <circle cx={cx} cy={70} r={10} strokeWidth={2.6} />
            <path d={`M${cx - 7},70 H${cx + 7} M${cx},63 V77`} strokeWidth={1.6} />
            <path d={`M${cx - 34},172 H${cx + 34} M${cx - 34},194 H${cx + 34} M${cx - 17},150 V214 M${cx + 17},150 V214`} strokeWidth={0.9} opacity={0.75} />
          </g>
          {/* 窓台 */}
          <rect x={cx - 40} y={212} width={80} height={6} />
        </g>
      ))}
      {/* 柱（柱頭・台座）と、上の蛇腹 */}
      {[0, 180, 360].map((x) => (
        <g key={x}>
          <rect x={x - 12} y={24} width={24} height={216} />
          <rect x={x - 16} y={30} width={32} height={6} />
          <rect x={x - 16} y={226} width={32} height={14} />
          <rect x={x - 3} y={36} width={6} height={190} fill={accent} opacity={0.06} />
        </g>
      ))}
      <rect x={0} y={16} width={360} height={4} fill={accent} opacity={0.12} />
    </>
  );
}

/** 尖頭アーチの列柱。壁から窓を抜く（evenodd） */
const ARCH_BAYS = [15, 165];
const archesPath =
  "M0,0 H300 V200 H0 Z " + ARCH_BAYS.map((x) => `M${x},200 V95 Q${x},35 ${x + 60},22 Q${x + 120},35 ${x + 120},95 V200 Z`).join(" ");

const STARS = range(46).map((i) => ({ x: 4 + rand(i, 1) * 392, y: 4 + rand(i, 2) * 192, r: 0.4 + rand(i, 3) * 1.1 }));

/** 星の色: 白・青白・暖色・薄紫を混ぜる */
const STAR_TINTS = ["#fff8ec", "#dce6ff", "#ffe6c4", "#e9dcff"];
/** 明るい星は、四方に光の筋を伸ばす */
const sparklePath = (x: number, y: number, s: number) =>
  `M${x},${y - s * 2.4} L${x + s * 0.32},${y - s * 0.32} L${x + s * 2.4},${y} L${x + s * 0.32},${y + s * 0.32} L${x},${y + s * 2.4} L${x - s * 0.32},${y + s * 0.32} L${x - s * 2.4},${y} L${x - s * 0.32},${y - s * 0.32} Z`;
const SPARKLES = range(5).map((i) => ({ x: 30 + i * 78 + rand(i, 50) * 30, y: 15 + rand(i, 51) * 150, s: 0.9 + rand(i, 52) * 0.8 }));
function starfield() {
  return (
    <>
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.85} fill={STAR_TINTS[i % 4]} opacity={0.3 + rand(i, 17) * 0.6} />
      ))}
      {SPARKLES.map((p, i) => (
        <g key={i} fill={STAR_TINTS[i % 4]}>
          <circle cx={p.x} cy={p.y} r={p.s * 2.4} opacity={0.08} />
          <path d={sparklePath(p.x, p.y, p.s)} opacity={0.85} />
        </g>
      ))}
    </>
  );
}


/** 書架: 棚板の間に背の不ぞろいな本を詰める */
function shelfBooks(x0: number, x1: number, shelfY: number, seed: number) {
  const books: ReactNode[] = [];
  let x = x0 + 2;
  let i = 0;
  while (x < x1 - 4) {
    const w = 4 + Math.floor(rand(seed + i, 4) * 6);
    const h = 24 + Math.floor(rand(seed + i, 5) * 14);
    if (x + w > x1 - 2) break;
    // ところどころ隙間を空け、まれに傾いた本を置く
    if (rand(seed + i, 6) > 0.9) {
      x += 6;
    } else if (rand(seed + i, 7) > 0.93) {
      books.push(<rect key={`${seed}-${i}`} x={x} y={shelfY - h + 2} width={w} height={h} transform={`rotate(-14 ${x + w} ${shelfY})`} />);
      x += w + 6;
    } else {
      books.push(<rect key={`${seed}-${i}`} x={x} y={shelfY - h} width={w} height={h} />);
      x += w + 0.8;
    }
    i++;
  }
  return books;
}

function bookcase(x: number, key: number, accent: string) {
  const width = 160;
  const shelves = [64, 110, 156, 200];
  return (
    <g key={key}>
      {/* 背板は淡く、奥の空がわずかに透ける */}
      <rect x={x} y={22} width={width} height={178} opacity={0.4} />
      <rect x={x - 4} y={14} width={width + 8} height={9} />
      <rect x={x} y={20} width={6} height={180} />
      <rect x={x + width - 6} y={20} width={6} height={180} />
      {shelves.map((y, i) => (
        <g key={y}>
          <rect x={x} y={y} width={width} height={5} />
          {shelfBooks(x + 6, x + width - 6, y, key * 40 + i * 9)}
        </g>
      ))}
      {/* 書架の上に灯る、一本の蝋燭 */}
      <rect x={x + 120} y={6} width={3} height={8} />
      <ellipse cx={x + 121.5} cy={3.5} rx={1.6} ry={2.8} fill={accent} className="expedition-flame" />
    </g>
  );
}

const TREES = [
  { cx: 60, top: 58, r: 32 },
  { cx: 150, top: 92, r: 24 },
  { cx: 238, top: 36, r: 40 },
  { cx: 336, top: 78, r: 28 },
];

/** 針葉樹: 幹と、裾の広がるぎざぎざの枝の段 [中心, 高さ, 幅] */
const PINES: [number, number, number][] = [
  [30, 150, 44], [78, 190, 56], [124, 120, 36], [170, 170, 50], [222, 200, 60], [270, 140, 42], [318, 180, 54], [366, 130, 40],
];
function pinePath([cx, h, w]: (typeof PINES)[number], seed: number) {
  const top = 200 - h;
  const tiers = 6;
  let d = `M${cx - 2},200 L${cx - 2},${200 - h * 0.12} L${cx + 2},${200 - h * 0.12} L${cx + 2},200 Z `;
  for (let t = 0; t < tiers; t++) {
    const y0 = top + (h * 0.88 * t) / tiers;
    const y1 = top + (h * 0.88 * (t + 1.5)) / tiers;
    const half = (w / 2) * ((t + 1.4) / (tiers + 0.4));
    const j = (k: number) => (rand(seed * 13 + t * 5 + k, 22) - 0.5) * 3;
    d += `M${cx},${y0} L${cx + half * 0.45 + j(1)},${y0 + (y1 - y0) * 0.55} L${cx + half * 0.3},${y0 + (y1 - y0) * 0.5} L${cx + half + j(2)},${y1} L${cx + half * 0.55},${y1 - 2} L${cx},${y1 + 1} L${cx - half * 0.55},${y1 - 2} L${cx - half + j(3)},${y1} L${cx - half * 0.3},${y0 + (y1 - y0) * 0.5} L${cx - half * 0.45 + j(4)},${y0 + (y1 - y0) * 0.55} Z `;
  }
  return d;
}
const PINE_D = PINES.map((p, i) => pinePath(p, i)).join(" ");

/** 手前の太い幹: 上は枠の外まで伸び、根を張り、枝を少し伸ばす */
const TRUNKS = [
  { cx: 70, w: 26, lean: -4 },
  { cx: 290, w: 34, lean: 5 },
];
function trunkPath({ cx, w, lean }: (typeof TRUNKS)[number]) {
  const l = cx - w / 2, r = cx + w / 2;
  return [
    // 幹（上ほど少し細く）と根
    `M${l + lean - 2},-4 C${l + lean * 0.6},60 ${l + 2},130 ${l - 4},178 C${l - 14},188 ${l - 26},194 ${l - 34},200 L${r + 34},200 C${r + 24},194 ${r + 12},188 ${r + 4},178 C${r - 2},130 ${r + lean * 0.6},60 ${r + lean + 2},-4 Z`,
    // 枝
    `M${cx + lean * 0.5},70 C${cx + 30},58 ${cx + 52},40 ${cx + 66},20 L${cx + 70},24 C${cx + 56},46 ${cx + 34},66 ${cx + lean * 0.5},82 Z`,
    `M${cx + lean * 0.5},40 C${cx - 26},30 ${cx - 44},16 ${cx - 54},-2 L${cx - 48},-4 C${cx - 38},12 ${cx - 22},24 ${cx + lean * 0.5},28 Z`,
    // 苔むした茂み
    `M${cx - 120},200 C${cx - 116},186 ${cx - 100},182 ${cx - 90},190 C${cx - 84},180 ${cx - 66},182 ${cx - 62},200 Z`,
  ];
}
/** 部位ごとに分けた幹の輪郭（向きの違う輪郭が重なると穴が開くので、別々の path で塗る） */
const TRUNK_PARTS = TRUNKS.flatMap(trunkPath);

const TOWERS = [
  { x: 40, w: 24, top: 90 },
  { x: 108, w: 16, top: 128 },
  { x: 168, w: 34, top: 58 },
  { x: 258, w: 20, top: 110 },
  { x: 318, w: 28, top: 78 },
];

const ICICLES = (() => {
  let d = "M0,0 H300 V16 ";
  for (let x = 0; x < 300; x += 12) {
    const len = 10 + rand(x, 8) * (rand(x, 9) > 0.7 ? 70 : 34);
    d += `L${x + 5},${16 + len} L${x + 10},16 L${x + 12},${16 + rand(x, 10) * 4} `;
  }
  return d + "V0 Z";
})();


/** 床の絵（高さ 64）で、少女が踏む地面の線の高さ */
const GROUND = 6;
/** 床の層の上端から地面の線までの割合。少女の足裏をここに合わせる */
export const FLOOR_SURFACE = GROUND / 64;

const GRASS = range(70).map((i) => {
  const x = 3 + i * 5.6 + rand(i, 14) * 2;
  const h = 3 + rand(i, 15) * 4;
  return `M${x - 1.6},${GROUND + 1} L${x + rand(i, 16) * 2 - 1},${GROUND + 1 - h} L${x + 1.6},${GROUND + 1} Z`;
}).join(" ");

/* ---------- STAGE 3 星空の観測塔 ---------- */

/** 星座: 明るい星を細い線で結ぶ（夜空の星は、どれも誰かの一夜）。先頭の星は光の筋を伸ばす */
const CONSTELLATIONS: [number, number][][] = [
  [[30, 60], [62, 44], [92, 58], [118, 40], [150, 52]],
  [[200, 120], [226, 96], [258, 104], [270, 136], [236, 150], [200, 120]],
  [[320, 40], [342, 70], [372, 62], [392, 90]],
  [[70, 150], [104, 132], [130, 160]],
];
function constellations(accent: string) {
  return (
    <>
      {STARS.map((s, i) => (
        <circle key={i} cx={(s.x * 500) / 400} cy={s.y} r={s.r * 0.7} fill={STAR_TINTS[i % 4]} opacity={0.2 + rand(i, 17) * 0.45} />
      ))}
      {CONSTELLATIONS.map((line, i) => (
        <g key={i}>
          <path
            d={`M${line.map(([x, y]) => `${x},${y}`).join(" L")}`}
            fill="none"
            stroke={accent}
            strokeWidth={0.4}
            strokeLinecap="round"
            strokeDasharray="0.1 2.2"
            opacity={0.55}
          />
          {line.map(([x, y], j) => (
            <g key={j}>
              <circle cx={x} cy={y} r={5} fill={accent} opacity={0.07} />
              {j === 0 ? <path d={sparklePath(x, y, 1.5)} fill="#fff8e6" opacity={0.95} /> : <circle cx={x} cy={y} r={1.1} fill="#fffbe8" opacity={0.9} />}
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

/**
 * 観測所の円屋根。屋根に細い開口が空いて内の灯が漏れ、架台に据えた望遠鏡がその開口から空へ突き出る。
 * angle は望遠鏡の仰角（度。右上が正）
 */
function observatoryDome(cx: number, base: number, r: number, angle: number, accent: string, key: string) {
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = -Math.sin(a);
  const px = -uy, py = ux;
  const pivot = [cx, base - r * 0.32] as const;
  const at = (along: number, side: number) => `${(pivot[0] + ux * along + px * side).toFixed(1)},${(pivot[1] + uy * along + py * side).toFixed(1)}`;
  const slitW = r * 0.24;
  const clip = `expedition-dome-${key}`;
  const domePath = `M${cx - r},${base} A${r},${r} 0 0,1 ${cx + r},${base} Z`;
  return (
    <g key={key}>
      <defs>
        <clipPath id={clip}>
          <path d={domePath} />
        </clipPath>
      </defs>
      {/* 円屋根を載せる胴と蛇腹 */}
      <rect x={cx - r - 4} y={base} width={r * 2 + 8} height={200 - base} />
      <rect x={cx - r - 7} y={base - 2} width={r * 2 + 14} height={4} />
      <rect x={cx - r - 7} y={base - 2} width={r * 2 + 14} height={0.8} fill={accent} opacity={0.3} />
      <path d={domePath} />
      {/* 円屋根の肋 */}
      <path
        d={`M${cx},${base - r} A${r * 0.45},${r} 0 0,0 ${cx - r * 0.45},${base} M${cx},${base - r} A${r * 0.45},${r} 0 0,1 ${cx + r * 0.45},${base} M${cx - r * 0.87},${base - r * 0.5} A${r},${r * 0.35} 0 0,1 ${cx + r * 0.87},${base - r * 0.5}`}
        fill="none"
        stroke={accent}
        strokeWidth={0.5}
        opacity={0.16}
      />
      {/* 開口: 望遠鏡の向きに沿って屋根が割れ、内の灯が漏れる */}
      <g clipPath={`url(#${clip})`}>
        <path d={`M${at(-r * 0.2, slitW / 2)} L${at(r * 1.6, slitW / 2)} L${at(r * 1.6, -slitW / 2)} L${at(-r * 0.2, -slitW / 2)} Z`} fill={accent} opacity={0.22} />
      </g>
      {/* 架台と、先へ行くほど太る筒。筒先には遮光の覆い、筒には締め輪 */}
      <path d={`M${cx - r * 0.12},${base} L${pivot[0] - r * 0.04},${pivot[1]} L${pivot[0] + r * 0.04},${pivot[1]} L${cx + r * 0.12},${base} Z`} />
      <path d={`M${at(-r * 0.32, r * 0.07)} L${at(r * 1.3, r * 0.1)} L${at(r * 1.3, -r * 0.1)} L${at(-r * 0.32, -r * 0.07)} Z`} />
      <path d={`M${at(r * 1.22, r * 0.13)} L${at(r * 1.45, r * 0.14)} L${at(r * 1.45, -r * 0.14)} L${at(r * 1.22, -r * 0.13)} Z`} />
      <path d={`M${at(r * 0.4, r * 0.085)} L${at(r * 0.4, -r * 0.085)} M${at(r * 0.85, r * 0.095)} L${at(r * 0.85, -r * 0.095)}`} stroke={accent} strokeWidth={0.6} opacity={0.35} />
      <circle cx={pivot[0]} cy={pivot[1]} r={r * 0.07} fill={accent} opacity={0.35} />
    </g>
  );
}
function domes(accent: string) {
  return (
    <>
      <rect x={0} y={178} width={400} height={22} />
      {observatoryDome(86, 122, 44, 40, accent, "a")}
      {/* 細い塔と、灯のともる窓 */}
      <rect x={180} y={70} width={26} height={130} />
      <path d="M176,72 L193,30 L210,72 Z" />
      <rect x={176} y={70} width={34} height={3} />
      {[90, 112, 134, 156].map((y, i) => (
        <path key={y} d={`M190,${y + 8} v-6 a3,3 0 0,1 6,0 v6 z`} fill={accent} opacity={i === 1 ? 0.3 : 0.65} />
      ))}
      {observatoryDome(300, 146, 30, 62, accent, "b")}
      {/* 渡り廊下のアーチ */}
      <path d="M134,152 H180 V200 H134 Z M142,200 V170 A7,7 0 0,1 156,170 V200 Z M160,200 V170 A7,7 0 0,1 174,170 V200 Z" fillRule="evenodd" />
      <path d="M206,164 H266 V200 H206 Z" />
      {range(3).map((i) => (
        <path key={i} d={`M${214 + i * 18},186 v-8 a3,3 0 0,1 6,0 v8 z`} fill={accent} opacity={0.4} />
      ))}
    </>
  );
}

/** 石の欄干: 上下の手すりの間に、壺形の小柱を並べる */
const BALUSTER = (x: number) =>
  `M${x - 3},52 C${x - 3},46 ${x - 6},40 ${x - 6},32 C${x - 6},24 ${x - 2.5},20 ${x - 2.5},14 L${x + 2.5},14 C${x + 2.5},20 ${x + 6},24 ${x + 6},32 C${x + 6},40 ${x + 3},46 ${x + 3},52 Z`;
function balustrade(accent: string) {
  return (
    <>
      <rect x={0} y={4} width={200} height={9} />
      <rect x={0} y={4} width={200} height={1} fill={accent} opacity={0.3} />
      <rect x={0} y={52} width={200} height={12} />
      {range(10).map((i) => (
        <path key={i} d={BALUSTER(10 + i * 20)} />
      ))}
      <rect x={96} y={0} width={14} height={64} />
    </>
  );
}

/* ---------- STAGE 4 蒼氷の大回廊 ---------- */

/** 時計塔: 大沈黙の夜、一斉に止まった針。塔の縁には氷柱が下がる */
const CLOCK_TOWERS = [
  { x: 40, w: 50, top: 70, time: [10, 8] },
  { x: 170, w: 70, top: 30, time: [11, 58] },
  { x: 300, w: 46, top: 90, time: [3, 41] },
];
const clockHand = (cx: number, cy: number, deg: number, len: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `M${cx},${cy} L${(cx + Math.cos(a) * len).toFixed(1)},${(cy + Math.sin(a) * len).toFixed(1)}`;
};
const clockTicks = (cx: number, cy: number, r: number) =>
  range(12)
    .map((k) => {
      const a = (k * 30 * Math.PI) / 180;
      return `M${(cx + Math.sin(a) * r * 0.82).toFixed(1)},${(cy - Math.cos(a) * r * 0.82).toFixed(1)} L${(cx + Math.sin(a) * r * 0.95).toFixed(1)},${(cy - Math.cos(a) * r * 0.95).toFixed(1)}`;
    })
    .join(" ");
function clocktower(accent: string) {
  return (
    <>
      <rect x={0} y={200} width={400} height={40} />
      {CLOCK_TOWERS.map(({ x, w, top, time: [h, m] }, i) => {
        const cx = x + w / 2, cy = top + w * 0.75, r = w * 0.36;
        const icicles = range(6)
          .map((k) => {
            const len = 6 + rand(i * 7 + k, 30) * 10;
            return `M${(x + 2 + k * (w / 6)).toFixed(1)},${top} l${(w / 24).toFixed(1)},${len.toFixed(1)} l${(w / 24).toFixed(1)},${(-len).toFixed(1)} Z`;
          })
          .join(" ");
        return (
          <g key={i}>
            <path d={`M${x},240 V${top} L${cx},${top - w * 0.9} L${x + w},${top} V240 Z`} />
            {/* 屋根の縁から下がる氷柱 */}
            <path d={icicles} />
            <circle cx={cx} cy={cy} r={r} fill={accent} opacity={0.16} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1} opacity={0.5} />
            <path d={clockTicks(cx, cy, r)} stroke={accent} strokeWidth={0.8} opacity={0.5} />
            <path
              d={`${clockHand(cx, cy, (h % 12) * 30 + m / 2, r * 0.5)} ${clockHand(cx, cy, m * 6, r * 0.78)}`}
              stroke={accent}
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.7}
            />
            {range(3).map((k) => (
              <rect key={k} x={cx - 2} y={cy + r + 14 + k * 26} width={4} height={10} rx={2} fill={accent} opacity={0.18} />
            ))}
          </g>
        );
      })}
    </>
  );
}

/** 氷の柱: 面取りした柱の中に、凍った誰かの一時間（結晶）が灯る。柱の間を薄い氷の弧が渡る */
function icepillars(accent: string) {
  const pillar = (x: number, i: number) => {
    const cy = 96 + rand(i, 31) * 50;
    const hex = range(6)
      .map((k) => {
        const a = (k * 60 * Math.PI) / 180;
        return `${(x + Math.cos(a) * 7).toFixed(1)},${(cy + Math.sin(a) * 9).toFixed(1)}`;
      })
      .join(" ");
    return (
      <g key={i}>
        <path d={`M${x - 16},220 L${x - 16},40 L${x - 10},30 L${x + 10},30 L${x + 16},40 L${x + 16},220 Z`} />
        {/* 柱頭の霜と、面取りの照り */}
        <path d={`M${x - 22},34 L${x + 22},34 L${x + 18},26 L${x - 18},26 Z`} />
        <path d={`M${x - 6},40 L${x - 6},214`} stroke={accent} strokeWidth={0.7} opacity={0.14} />
        <circle cx={x} cy={cy} r={16} fill={accent} opacity={0.1} />
        <polygon points={hex} fill={accent} opacity={0.5} />
        <polygon points={hex} fill="none" stroke="#ffffff" strokeWidth={0.6} opacity={0.5} />
      </g>
    );
  };
  return (
    <>
      {pillar(60, 0)}
      {pillar(240, 1)}
      <path d="M76,52 Q150,0 224,52 L224,60 Q150,10 76,60 Z" opacity={0.85} />
      <path d="M256,52 Q308,14 360,40 L360,48 Q308,22 256,60 Z" opacity={0.85} />
      <path d="M0,40 Q20,26 44,52 L44,60 Q20,34 0,48 Z" opacity={0.85} />
    </>
  );
}

/** 氷の結晶の群れ: [根元の中心, 高さ, 幅, 傾き] */
const CRYSTAL_SHARDS: [number, number, number, number][] = [
  [40, 96, 18, -10], [58, 150, 24, 3], [78, 108, 18, 12], [92, 64, 12, 18],
  [190, 70, 14, -14], [206, 124, 20, -2], [224, 90, 16, 10],
  [318, 112, 18, -8], [338, 172, 26, 2], [360, 120, 20, 9], [376, 70, 12, 16],
];
/** 面取りした結晶: 暗い面と、灯を受けて明るい面。稜線と縁に光、先にきらめき */
function crystalShard([cx, h, w, tilt]: (typeof CRYSTAL_SHARDS)[number], i: number, accent: string) {
  const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const bl = [cx - w / 2, 200], br = [cx + w / 2, 200];
  const sl = [cx - w / 2 + tilt * 0.6, 200 - h * 0.8], sr = [cx + w / 2 + tilt * 0.6, 200 - h * 0.8];
  const tip = [cx + tilt, 200 - h];
  const mid = [cx + w * 0.08, 200];
  const ridgeTop = [cx + tilt * 0.62 + w * 0.06, 200 - h * 0.82];
  const id = gradId("facet", accent);
  return (
    <g key={i}>
      <path d={`M${p(bl[0], bl[1])} L${p(sl[0], sl[1])} L${p(tip[0], tip[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(mid[0], mid[1])} Z`} />
      <path d={`M${p(mid[0], mid[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(tip[0], tip[1])} L${p(sr[0], sr[1])} L${p(br[0], br[1])} Z`} />
      <path d={`M${p(mid[0], mid[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(tip[0], tip[1])} L${p(sr[0], sr[1])} L${p(br[0], br[1])} Z`} fill={`url(#${id})`} />
      <path d={`M${p(sl[0], sl[1])} L${p(tip[0], tip[1])} L${p(sr[0], sr[1])}`} fill="none" stroke={accent} strokeWidth={0.6} opacity={0.55} strokeLinejoin="round" />
      <path d={`M${p(mid[0], mid[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(tip[0], tip[1])}`} fill="none" stroke="#ffffff" strokeWidth={0.4} opacity={0.3} />
      {h > 100 && <path d={sparklePath(tip[0], tip[1] + 2, 1.1)} fill="#ffffff" opacity={0.8} />}
    </g>
  );
}
function crystalField(accent: string) {
  const id = gradId("facet", accent);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.42" />
          <stop offset="0.6" stopColor={accent} stopOpacity="0.14" />
          <stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="1" r="0.6">
          <stop offset="0" stopColor={accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 群れの根元の光 */}
      {[64, 208, 344].map((x) => (
        <ellipse key={x} cx={x} cy={200} rx={60} ry={36} fill={`url(#${id}-glow)`} />
      ))}
      {CRYSTAL_SHARDS.map((s, i) => crystalShard(s, i, accent))}
      {/* 根元に積もる霜 */}
      <path d="M0,200 C20,192 40,190 60,194 C80,188 110,190 130,196 C160,192 180,188 210,193 C240,190 270,194 300,192 C330,186 360,190 400,196 L400,200 Z" />
      <path d="M0,200 C20,192 40,190 60,194 C80,188 110,190 130,196 C160,192 180,188 210,193 C240,190 270,194 300,192 C330,186 360,190 400,196" fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={0.25} />
    </>
  );
}

/* ---------- STAGE 5 紅蓮の魔導炉 ---------- */

/**
 * 錬金術の器具。どれも床（下端）に据える。
 * 炉台に掛けた硝子の蒸留器（中の液が灯り、泡が立つ）と受け瓶、鎖で吊られて溶けた星の光る坩堝、配管と弁、ルーンの台
 */
function alchemy(accent: string) {
  const id = gradId("brew", accent);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2c8" stopOpacity="0.95" />
          <stop offset="0.25" stopColor={accent} stopOpacity="0.85" />
          <stop offset="1" stopColor={accent} stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={`${id}-molten`} cx="0.45" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.45" stopColor={accent} />
          <stop offset="1" stopColor={accent} stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={accent} stopOpacity="0.4" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-flask`}>
          <circle cx={78} cy={150} r={27} />
        </clipPath>
      </defs>
      {/* 炉台: 三本脚と、熾火の灯る火皿 */}
      <path d="M52,220 L60,184 L64,184 L58,220 Z M104,220 L96,184 L92,184 L98,220 Z M76,220 L76,184 L80,184 L80,220 Z" />
      <path d="M50,180 H106 L100,188 H56 Z" />
      <ellipse cx={78} cy={180} rx={22} ry={3} fill={accent} opacity={0.65} className="expedition-flame" />
      {/* 硝子の蒸留器: 胴は暗い硝子、中の液は上ほど明るく、泡が立つ */}
      <circle cx={78} cy={150} r={28} opacity={0.6} />
      <g clipPath={`url(#${id}-flask)`}>
        <rect x={48} y={152} width={60} height={30} fill={`url(#${id})`} />
        <path d="M50,152 Q78,149 106,152" fill="none" stroke="#fff6dc" strokeWidth={0.9} opacity={0.85} />
        {[[66, 166, 1.6], [84, 170, 1.1], [74, 160, 0.9], [92, 162, 1.3], [80, 174, 0.8]].map(([x, y, r], k) => (
          <circle key={k} cx={x} cy={y} r={r} fill="none" stroke="#fff6dc" strokeWidth={0.5} opacity={0.7} />
        ))}
      </g>
      <circle cx={78} cy={150} r={28} fill="none" stroke={accent} strokeWidth={0.7} opacity={0.4} />
      <path d="M62,134 A20,20 0 0,1 74,126" fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.3} strokeLinecap="round" />
      {/* 首と、受け瓶へ下る細い管 */}
      <path d="M70,124 L70,104 C70,88 98,76 128,86 L184,122 L180,128 L126,94 C102,86 86,94 86,106 L86,124 Z" opacity={0.85} />
      <path d="M86,106 C86,94 102,86 126,94 L180,128" fill="none" stroke={accent} strokeWidth={0.5} opacity={0.35} />
      <path d="M182,126 L190,190" stroke="currentColor" strokeWidth={2.4} />
      {/* 受け瓶と、溜まった滴 */}
      <path d="M180,190 C176,198 174,212 182,220 L198,220 C206,212 204,198 200,190 Z" opacity={0.65} />
      <path d="M177,204 C177,214 180,220 182,220 L198,220 C200,220 203,214 203,204 Z" fill={`url(#${id})`} opacity={0.75} />
      <path d="M180,190 C176,198 174,212 182,220 L198,220 C206,212 204,198 200,190 Z" fill="none" stroke={accent} strokeWidth={0.6} opacity={0.35} />
      {/* 鎖で吊られた坩堝。溶けた星の面が光り、上に熱の暈 */}
      <path d="M244,0 V84 M254,0 V84" stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" fill="none" />
      <ellipse cx={249} cy={86} rx={40} ry={18} fill={`url(#${id}-halo)`} />
      <path d="M224,88 H274 L268,118 C264,130 234,130 230,118 Z" />
      <ellipse cx={249} cy={89} rx={23} ry={4.2} fill={`url(#${id}-molten)`} className="expedition-flame" />
      <path d="M226,96 H272" stroke={accent} strokeWidth={0.6} opacity={0.3} />
      {[[240, 78], [258, 74], [250, 68]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={0.9} fill="#fff2c8" opacity={0.8} />
      ))}
      {/* 配管と弁 */}
      <path d="M306,220 V122 C306,106 318,98 334,98 H420 V110 H336 C326,110 320,116 320,126 V220 Z" />
      <circle cx={366} cy={104} r={11} />
      <circle cx={366} cy={104} r={11} fill="none" stroke={accent} strokeWidth={0.6} opacity={0.35} />
      <path d="M358,96 L374,112 M374,96 L358,112" stroke={accent} strokeWidth={0.8} opacity={0.3} />
      {/* ルーンの刻まれた台と、積んだ古書 */}
      <path d="M222,220 L228,190 H292 L298,220 Z" />
      <path d="M234,204 h6 m6,0 h8 m6,0 h4 m6,0 h10" stroke={accent} strokeWidth={1.2} opacity={0.55} className="expedition-flame" />
      <path d="M130,220 V212 H160 V220 Z M134,212 V205 H158 V212 Z M128,205 V199 H154 V205 Z" />
      <path d="M130,212 H160 M134,205 H158" stroke={accent} strokeWidth={0.4} opacity={0.25} />
    </>
  );
}

/* ---------- STAGE 6 天空の大聖堂 ---------- */

const CLOUD_PUFFS2 = range(14).map((i) => ({ cx: 18 + i * 36 + rand(i, 11) * 14, cy: 58 - rand(i, 12) * 22, r: 16 + rand(i, 13) * 18 }));
/** 雲の帯: 上は明るく、下は霞へ溶ける */
function cloudBank() {
  return (
    <>
      <defs>
        <linearGradient id="expedition-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.25" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <g fill="url(#expedition-cloud)">
        <rect x={0} y={60} width={500} height={40} />
        {CLOUD_PUFFS2.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy + 18} r={c.r} />
        ))}
      </g>
    </>
  );
}

/** 雲に浮かぶ聖堂の島: 岩の島の上に尖塔の聖堂が立ち、下には岩が垂れる */
const ISLES = [
  { cx: 80, y: 120, w: 90 },
  { cx: 270, y: 80, w: 130 },
  { cx: 430, y: 140, w: 70 },
];
function skyisles(accent: string) {
  return (
    <>
      {ISLES.map(({ cx, y, w }, i) => {
        const l = cx - w / 2, r = cx + w / 2;
        return (
          <g key={i}>
            {/* 岩の島と、垂れる岩 */}
            <path d={`M${l},${y} L${r},${y} L${r - w * 0.12},${y + 10} L${cx + w * 0.2},${y + 40} L${cx + 4},${y + 64} L${cx - w * 0.18},${y + 34} L${l + w * 0.1},${y + 12} Z`} />
            {/* 聖堂: 身廊と尖塔 */}
            <rect x={cx - w * 0.3} y={y - w * 0.3} width={w * 0.6} height={w * 0.3} />
            <path d={`M${cx - w * 0.32},${y - w * 0.3} L${cx},${y - w * 0.46} L${cx + w * 0.32},${y - w * 0.3} Z`} />
            <path d={`M${cx + w * 0.16},${y} V${y - w * 0.62} L${cx + w * 0.22},${y - w * 0.9} L${cx + w * 0.28},${y - w * 0.62} V${y} Z`} />
            <path d={`M${cx - w * 0.28},${y} V${y - w * 0.48} L${cx - w * 0.23},${y - w * 0.68} L${cx - w * 0.18},${y - w * 0.48} V${y} Z`} />
            <circle cx={cx} cy={y - w * 0.18} r={w * 0.05} fill={accent} opacity={0.6} />
          </g>
        );
      })}
    </>
  );
}

/** 鈴の形 */
const bellPath = (cx: number, top: number, s: number) =>
  `M${cx - 9 * s},${top + 26 * s} C${cx - 9 * s},${top + 14 * s} ${cx - 6 * s},${top + 8 * s} ${cx},${top + 8 * s} C${cx + 6 * s},${top + 8 * s} ${cx + 9 * s},${top + 14 * s} ${cx + 9 * s},${top + 26 * s} L${cx + 11 * s},${top + 29 * s} L${cx - 11 * s},${top + 29 * s} Z`;
/**
 * 鈴の列柱: 雲の上に並ぶ聖堂の列柱。アーチには二重の刳形と要石、柱には柱頭と台座、上端は少し崩れている。
 * アーチから下がる鈴は縁に灯を受け、舌が淡く光る
 */
const BELFRY_BAYS = [90, 270];
function belfry(accent: string) {
  return (
    <>
      <path
        d={`M0,16 H360 V220 H0 Z ${BELFRY_BAYS.map((cx) => `M${cx - 60},220 V100 Q${cx - 60},50 ${cx},38 Q${cx + 60},50 ${cx + 60},100 V220 Z`).join(" ")}`}
        fillRule="evenodd"
      />
      {/* 崩れかけの上端と、蛇腹 */}
      <path d="M0,16 L24,20 L46,13 L80,18 L120,12 L150,19 L176,12 L212,18 L248,11 L284,18 L320,13 L344,19 L360,15 V30 H0 Z" />
      <rect x={0} y={30} width={360} height={3} fill={accent} opacity={0.18} />
      {BELFRY_BAYS.map((cx) => (
        <g key={cx}>
          {/* 二重の刳形と要石 */}
          <path d={`M${cx - 60},100 Q${cx - 60},50 ${cx},38 Q${cx + 60},50 ${cx + 60},100`} fill="none" stroke={accent} strokeWidth={0.9} opacity={0.35} />
          <path d={`M${cx - 54},102 Q${cx - 54},58 ${cx},47 Q${cx + 54},58 ${cx + 54},102`} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.2} />
          <path d={`M${cx - 5},34 L${cx + 5},34 L${cx + 4},44 L${cx - 4},44 Z`} />
          {/* 鈴と吊り金具、灯を受ける縁と光る舌 */}
          <path d={`M${cx},44 V${52}`} stroke="currentColor" strokeWidth={1.6} />
          <path d={bellPath(cx, 44, 1.05)} />
          <path d={bellPath(cx, 44, 1.05)} fill="none" stroke={accent} strokeWidth={0.7} opacity={0.5} />
          <circle cx={cx} cy={76} r={2.6} fill={accent} opacity={0.8} />
          <circle cx={cx} cy={76} r={7} fill={accent} opacity={0.1} />
        </g>
      ))}
      {/* 柱頭・台座と、柱の溝 */}
      {[0, 180, 360].map((x) => (
        <g key={x}>
          <rect x={x - 32} y={96} width={64} height={5} />
          <rect x={x - 32} y={96} width={64} height={0.8} fill={accent} opacity={0.3} />
          <rect x={x - 34} y={206} width={68} height={14} />
          <path d={`M${x - 14},104 V206 M${x - 4},104 V206 M${x + 6},104 V206 M${x + 16},104 V206`} stroke={accent} strokeWidth={0.5} opacity={0.12} />
        </g>
      ))}
    </>
  );
}

/* ---------- 星天の塔 ---------- */

/**
 * 浮かぶ島: 上面は平らな石畳で縁が灯を受け、ルーンの環が光る。下は岩がぎざぎざに垂れ、鎖と結晶が下がる。
 * 島の下には淡い光が滲む
 */
function floatingIsle(x: number, y: number, w: number, i: number, accent: string) {
  const depth = w * 0.55;
  const under = range(7)
    .map((k) => {
      const t = 1 - k / 6;
      const px = x + 4 + (w - 8) * t;
      const dip = Math.sin(t * Math.PI) * depth * (0.55 + rand(i * 9 + k, 60) * 0.45);
      return `L${px.toFixed(1)},${(y + 6 + dip).toFixed(1)}`;
    })
    .join(" ");
  const id = gradId("isle", accent);
  return (
    <g key={i}>
      <ellipse cx={x + w / 2} cy={y + depth * 0.9} rx={w * 0.55} ry={depth * 0.6} fill={`url(#${id})`} />
      <path d={`M${x},${y} H${x + w} L${x + w - 4},${y + 6} ${under} L${x + 4},${y + 6} Z`} />
      {/* 岩肌の割れ目 */}
      <path d={`M${x + w * 0.3},${y + 8} L${x + w * 0.36},${y + depth * 0.4} L${x + w * 0.32},${y + depth * 0.6} M${x + w * 0.62},${y + 8} L${x + w * 0.58},${y + depth * 0.35}`} stroke={accent} strokeWidth={0.4} opacity={0.18} fill="none" />
      <rect x={x} y={y - 0.6} width={w} height={1.2} fill={accent} opacity={0.45} />
      {/* ルーンの環 */}
      <ellipse cx={x + w / 2} cy={y - 1} rx={w * 0.22} ry={2.4} fill="none" stroke={accent} strokeWidth={0.7} opacity={0.6} />
      {/* 下がる鎖と結晶 */}
      <path d={`M${x + w * 0.7},${y + depth * 0.4} V${y + depth * 0.4 + 16}`} stroke="currentColor" strokeWidth={0.8} strokeDasharray="2 1.2" />
      <path d={`M${x + w * 0.7},${y + depth * 0.4 + 16} l2.4,4 l-2.4,5 l-2.4,-5 Z`} fill={accent} opacity={0.75} />
    </g>
  );
}
function fragments(accent: string) {
  const id = gradId("isle", accent);
  return (
    <>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.3" r="0.5">
          <stop offset="0" stopColor={accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {floatingIsle(20, 112, 84, 0, accent)}
      {floatingIsle(170, 62, 56, 1, accent)}
      {floatingIsle(296, 132, 92, 2, accent)}
      {/* 島に立つ折れた柱 */}
      <path d="M44,112 V86 L48,82 L52,88 L56,84 V112 Z" />
      <path d="M318,132 V100 H328 V106 L332,102 V132 Z" />
      {/* 宙に浮かぶ階段の欠片（それぞれの段の下にも岩が残る） */}
      {range(5).map((i) => (
        <path key={i} d={`M${232 + i * 13},${150 - i * 13} h14 v4 l-4,5 h-7 l-3,-5 Z`} />
      ))}
    </>
  );
}


export const ART: Record<ExpeditionArt, Art> = {
  constellations: { width: 500, height: 200, render: constellations },
  domes: { width: 400, height: 200, render: domes },
  balustrade: { width: 200, height: 64, render: balustrade },
  clocktower: { width: 400, height: 240, render: clocktower },
  icepillars: { width: 360, height: 220, render: icepillars },
  alchemy: { width: 420, height: 220, render: alchemy },
  skyisles: { width: 500, height: 200, render: skyisles },
  belfry: { width: 360, height: 220, render: belfry },
  fragments: { width: 400, height: 200, render: fragments },
  pines: { width: 400, height: 200, render: () => <path d={PINE_D} /> },
  trunks: { width: 400, height: 200, render: () => TRUNK_PARTS.map((d, i) => <path key={i} d={d} />) },
  cathedral: { width: 360, height: 240, render: cathedral },
  stars: {
    width: 400,
    height: 200,
    render: starfield,
  },
  arches: {
    width: 300,
    height: 200,
    render: () => <path d={archesPath} fillRule="evenodd" />,
  },
  shelves: {
    width: 360,
    height: 200,
    render: (accent) => [bookcase(10, 0, accent), bookcase(190, 1, accent)],
  },
  trees: {
    width: 400,
    height: 200,
    render: () =>
      TREES.map(({ cx, top, r }, i) => (
        <g key={i}>
          <path d={`M${cx - 4},200 L${cx - 2.5},${top + r} L${cx + 2.5},${top + r} L${cx + 4},200 Z`} />
          <circle cx={cx} cy={top + r} r={r} />
          <circle cx={cx - r * 0.62} cy={top + r * 1.35} r={r * 0.72} />
          <circle cx={cx + r * 0.6} cy={top + r * 1.3} r={r * 0.68} />
          <ellipse cx={cx + (i % 2 ? 26 : -24)} cy={196} rx={18} ry={9} />
        </g>
      )),
  },
  spires: {
    width: 400,
    height: 200,
    render: (accent) => (
      <>
        <rect x={0} y={172} width={400} height={28} />
        {TOWERS.map(({ x, w, top }, i) => (
          <g key={i}>
            <path d={`M${x},200 V${top} H${x - 3} L${x + w / 2},${top - w * 1.5} L${x + w + 3},${top} H${x + w} V200 Z`} />
            {range(Math.floor((168 - top) / 26)).map((j) =>
              rand(i * 7 + j, 18) > 0.35 ? (
                <path
                  key={j}
                  d={`M${x + w / 2 - 2},${top + 22 + j * 26} v-5 a2,2 0 0,1 4,0 v5 z`}
                  fill={accent}
                  opacity={0.55 + rand(i + j, 19) * 0.4}
                />
              ) : null,
            )}
          </g>
        ))}
      </>
    ),
  },
  crystals: { width: 400, height: 200, render: crystalField },
  icicles: {
    width: 300,
    height: 100,
    render: (accent) => (
      <>
        <path d={ICICLES} />
        <rect x={0} y={15} width={300} height={0.8} fill={accent} opacity={0.25} />
      </>
    ),
  },
  forge: {
    width: 400,
    height: 200,
    render: (accent) => (
      <>
        {/* 炉と煙突、炉の口に揺れる熾火 */}
        <path d="M30,200 V122 Q85,78 140,122 V200 Z M76,104 V22 H96 V96 Z M72,22 H100 V14 H72 Z" />
        <g opacity={0.4}>
          <path d="M62,200 V164 Q85,138 108,164 V200 Z" fill={accent} className="expedition-flame" />
        </g>
        <rect x={140} y={92} width={124} height={7} />
        <path d="M262,200 V44 H288 V200 Z M258,44 H292 V36 H258 Z M258,120 H292 V128 H258 Z" />
        {/* 金床 */}
        <path d="M184,200 L190,176 H176 C172,170 176,164 184,164 H222 C224,170 216,176 208,176 L214,200 Z" />
        {/* 大釜と、その上の照り返し */}
        <ellipse cx={346} cy={166} rx={30} ry={24} />
        <path d="M322,182 L316,200 H324 L330,186 Z M370,182 L376,200 H368 L362,186 Z" />
        <ellipse cx={346} cy={146} rx={24} ry={4} fill={accent} opacity={0.55} />
      </>
    ),
  },
  clouds: { width: 500, height: 100, render: cloudBank },
  floor: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <defs>
          <linearGradient id={gradId("floor", accent)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.16" />
            <stop offset="0.45" stopColor={accent} stopOpacity="0.04" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        {/* 磨いた石の床に、灯がぼんやり映る */}
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} fill={`url(#${gradId("floor", accent)})`} />
        <rect x={0} y={GROUND} width={400} height={0.8} fill={accent} opacity={0.35} />
        <path
          d="M0,26 H400 M0,46 H400 M60,6 V26 M180,6 V26 M300,6 V26 M120,26 V46 M240,26 V46 M360,26 V46 M30,46 V64 M150,46 V64 M270,46 V64 M390,46 V64"
          stroke={accent}
          strokeWidth={0.6}
          opacity={0.08}
          fill="none"
        />
      </>
    ),
  },
  // 魔導炉の床: 黒い石に、熾火のひびが走って光る
  magma: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        <rect x={0} y={GROUND} width={400} height={0.8} fill={accent} opacity={0.4} />
        <path
          d="M20,64 L34,44 L28,30 L46,14 M120,64 L112,48 L126,36 L118,22 M210,64 L222,50 L214,40 L232,24 L228,12 M300,64 L292,46 L306,34 M360,64 L372,42 L366,26 L380,12"
          fill="none"
          stroke={accent}
          strokeWidth={0.8}
          opacity={0.3}
          className="expedition-flame"
        />
        <path d="M34,44 L50,40 M126,36 L140,40 M214,40 L200,34 M306,34 L320,30" fill="none" stroke={accent} strokeWidth={0.5} opacity={0.2} />
      </>
    ),
  },
  grass: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        <path d={GRASS} />
        {range(7).map((i) => (
          <circle key={i} cx={28 + i * 56 + rand(i, 20) * 20} cy={GROUND - 2 - rand(i, 21) * 2} r={0.9} fill={accent} opacity={0.7} />
        ))}
      </>
    ),
  },
};

/** 層の絵の幅 ÷ 高さ */
export function sourceAspect(source: ExpeditionSource) {
  if ("image" in source) return source.aspect;
  const art = ART[source.art];
  return art.width / art.height;
}

/** 層に並べる1枚分の絵。描く絵は SVG で、画像は <img> で読み込む */
export function BackdropTile({ source, accent, rim = 0 }: { source: ExpeditionSource; accent: string; rim?: number }) {
  const aspectRatio = sourceAspect(source);
  if ("image" in source) {
    // 背景画像は飾り。読み込みの順は景色の見え方だけに関わるので、遅らせて構わない
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={source.image} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-auto max-w-none shrink-0 select-none" style={{ aspectRatio }} />;
  }
  const art = ART[source.art];
  return (
    <svg viewBox={`0 0 ${art.width} ${art.height}`} className="h-full w-auto shrink-0" style={{ aspectRatio }} fill="currentColor" aria-hidden>
      {/* 影絵の上の縁に差す光: 同じ絵を少し上へずらして灯の色で敷き、その上に影絵を重ねる */}
      {rim > 0 && (
        <g transform="translate(0 -1.2)" fill={accent} stroke={accent} opacity={rim} style={{ color: accent }}>
          {art.render(accent)}
        </g>
      )}
      {art.render(accent)}
    </svg>
  );
}
