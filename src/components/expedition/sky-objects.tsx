import type { CSSProperties } from "react";
import type { ExpeditionCelestial } from "@/lib/expedition";
import { StarSky } from "./star-sky";

/**
 * 探索の景色の空に掛かる、流れない大きな物（星空・月・天文盤・オーロラ・炉心・星冠・星雲・瞬く星・流れ星・塔）。
 * どれも遠く、少女が歩いても動かない。回転や明滅は transform と opacity だけで行う
 */

/** 決定的な疑似乱数（SSR とクライアントで同じ絵にする） */
const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)] as const;
};

/** 正確な角度の点（真上から時計回り） */
const pol = (r: number, deg: number, cx = 0, cy = 0) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)] as const;
};
/** 縁の目盛り: 2.5° ごとに細く、15° ごとに長く */
const LIMB_TICKS = range(144)
  .map((i) => {
    const deg = i * 2.5;
    const inner = i % 6 === 0 ? 82 : i % 2 === 0 ? 84.5 : 86;
    const [x1, y1] = pol(inner, deg), [x2, y2] = pol(87.5, deg);
    return `M${x1},${y1} L${x2},${y2}`;
  })
  .join(" ");
/** 外周の歯。ところどころ欠けている（刻の崩壊で、世界の暦の歯が欠けていった） */
const LIMB_TEETH = range(120)
  .filter((i) => !(i % 13 === 5 || rand(i, 1) > 0.9))
  .map((i) => {
    const a = i * 3;
    const [x1, y1] = pol(92, a - 0.9), [x2, y2] = pol(96, a - 0.5), [x3, y3] = pol(96, a + 0.5), [x4, y4] = pol(92, a + 0.9);
    return `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`;
  })
  .join(" ");
const HOURS = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
/** 盤: 天頂へ寄っていく高度の円と、天頂から地平へ落ちる方位の弧、回帰線の円 */
const ZENITH_Y = -14;
const ALMUCANTARS = range(9).map((k) => {
  const f = k / 9;
  return { cy: -6 + (ZENITH_Y + 6) * f ** 0.9, r: 52 * (1 - f) + 2 };
});
const AZIMUTHS = [-70, -45, -22, 0, 22, 45, 70]
  .map((deg) => {
    const [x, y] = pol(52, 180 + deg, 0, -6);
    const c = deg * 0.9;
    return `M0,${ZENITH_Y} Q${(c * 0.6).toFixed(1)},${((ZENITH_Y + y) / 2).toFixed(1)} ${x},${y}`;
  })
  .join(" ");
/** 網（レテ）の炎の形の指針: 根元から弧を描いて星を指す */
const RETE_POINTERS = [
  [16, 40, 66], [52, 38, 72], [96, 40, 60], [140, 38, 70], [182, 40, 64], [224, 38, 74], [266, 40, 62], [310, 38, 70], [338, 40, 58],
].map(([deg, from, to], i) => {
  const [x0, y0] = pol(from, deg), [x1, y1] = pol(to, deg + 12), [cx1, cy1] = pol((from + to) / 2 + 6, deg - 4);
  const [w0x, w0y] = pol(from, deg + 7);
  return { d: `M${x0},${y0} Q${cx1},${cy1} ${x1},${y1} Q${((cx1 + w0x) / 2).toFixed(1)},${((cy1 + w0y) / 2).toFixed(1)} ${w0x},${w0y} Z`, tip: [x1, y1] as const, bright: i % 3 === 0 };
});
/** 黄道の輪の十二の宮の区切り（輪の中心は盤の中心からずれる） */
// 回る網の上で輪がぶれて見えないよう、黄道の輪は盤の中心に置く
const ECLIPTIC = { cy: 0, r: 52 };
const ECLIPTIC_TICKS = range(72)
  .map((i) => {
    const deg = i * 5;
    const [x1, y1] = pol(ECLIPTIC.r - (i % 6 === 0 ? 5 : 2.4), deg, 0, ECLIPTIC.cy), [x2, y2] = pol(ECLIPTIC.r, deg, 0, ECLIPTIC.cy);
    return `M${x1},${y1} L${x2},${y2}`;
  })
  .join(" ");

/**
 * 天文盤（アストロラーベ）。真鍮の線で描く。動かない盤（高度の円・方位の弧・回帰線）と縁（細かな目盛り・時の数字・欠けた歯）、
 * 頂の玉座と吊り輪。盤の上を、炎の形の指針と黄道の輪を持つ網がゆっくり回り、中心の定規は逆へ回る。後ろに柔らかな金の暈
 */
function Astrolabe({ color }: { color: string }) {
  return (
    <div className="relative size-full">
      <div className="absolute inset-[-8%] rounded-full" style={{ background: `radial-gradient(circle, ${color}1c, ${color}0a 45%, transparent 70%)` }} />
      {/* 動かない縁と盤 */}
      {/* 盤の中心を箱の中心にそろえる（頂の玉座の分だけ、上下に同じ余白を取る） */}
      <svg viewBox="-112 -112 224 224" className="absolute inset-0 size-full overflow-visible" fill="none" stroke={color}>
        <g opacity={0.6}>
          <path d={LIMB_TEETH} fill={color} stroke="none" opacity={0.5} />
          <circle r={92} strokeWidth={1.1} />
          <circle r={88} strokeWidth={0.5} />
          <path d={LIMB_TICKS} strokeWidth={0.35} />
          <circle r={80} strokeWidth={0.7} />
          {HOURS.map((h, i) => {
            const [x, y] = pol(74.5, i * 30);
            return (
              <text key={h} x={x} y={y} fontSize={4.6} fill={color} stroke="none" textAnchor="middle" dominantBaseline="central" fontFamily="serif" opacity={0.9} transform={`rotate(${i * 30} ${x} ${y})`}>
                {h}
              </text>
            );
          })}
          <circle r={69} strokeWidth={0.4} />
        </g>
        <g opacity={0.32}>
          {/* 回帰線と赤道 */}
          <circle r={68} strokeWidth={0.4} />
          <circle r={50} strokeWidth={0.35} strokeDasharray="1 1.4" />
          <circle r={36} strokeWidth={0.4} />
          {ALMUCANTARS.map(({ cy, r }, k) => (
            <circle key={k} cy={cy} r={r} strokeWidth={k === 0 ? 0.55 : 0.3} />
          ))}
          <path d={AZIMUTHS} strokeWidth={0.3} />
          <path d="M-68,0 H68 M0,-68 V68" strokeWidth={0.3} />
        </g>
        {/* 頂の玉座と吊り輪 */}
        <g opacity={0.65}>
          <path d="M-12,-90 C-12,-98 -6,-100 0,-104 C6,-100 12,-98 12,-90" strokeWidth={0.9} />
          <path d="M-7,-92 C-5,-97 -2,-98 0,-100 C2,-98 5,-97 7,-92" strokeWidth={0.5} />
          <circle cy={-104} r={1.4} fill={color} stroke="none" />
          <circle cy={-108.5} r={3.4} strokeWidth={0.9} />
        </g>
      </svg>
      {/* ゆっくり回る網（レテ） */}
      <div className="sky-astrolabe-turn absolute inset-[5.357%]">
        <svg viewBox="-100 -100 200 200" className="size-full overflow-visible" fill="none" stroke={color}>
          <g opacity={0.75}>
            <circle r={68} strokeWidth={0.9} />
            <circle r={36} strokeWidth={0.8} />
            <path d="M-68,0 H-36 M36,0 H68 M0,36 V68" strokeWidth={0.8} />
            {/* 黄道の輪と、十二の宮の目盛り */}
            <circle cy={ECLIPTIC.cy} r={ECLIPTIC.r} strokeWidth={0.9} />
            <circle cy={ECLIPTIC.cy} r={ECLIPTIC.r - 5} strokeWidth={0.4} />
            <path d={ECLIPTIC_TICKS} strokeWidth={0.35} />
            {/* 炎の形の指針と、その先の星 */}
            {RETE_POINTERS.map(({ d, tip: [x, y], bright }, i) => (
              <g key={i}>
                <path d={d} fill={color} fillOpacity={0.14} strokeWidth={0.35} />
                <circle cx={x} cy={y} r={bright ? 4 : 2.6} fill={color} stroke="none" opacity={0.12} />
                <circle cx={x} cy={y} r={bright ? 1.2 : 0.8} fill="#fff8e0" stroke="none" />
              </g>
            ))}
            {/* 網の透かし: 内の円をつなぐ四つ葉の飾り */}
            <path d="M0,-36 C14,-30 14,-14 0,-8 C-14,-14 -14,-30 0,-36 Z M0,36 C14,30 14,14 0,8 C-14,14 -14,30 0,36 Z" strokeWidth={0.5} />
          </g>
        </svg>
      </div>
      {/* 逆へ回る定規 */}
      <div className="sky-astrolabe-turn-back absolute inset-[5.357%]">
        <svg viewBox="-100 -100 200 200" className="size-full overflow-visible" fill={color} stroke="none">
          <path d="M-82,0 L-60,-2.2 L60,-2.2 L82,0 L60,2.2 L-60,2.2 Z" opacity={0.45} />
          <circle r={4} opacity={0.8} />
          <circle r={1.6} fill="#fff8e0" />
        </svg>
      </div>
    </div>
  );
}

/** 凍った星脈のオーロラ。縦に光が垂れる幕を三枚重ね、ゆっくり揺らす */
const AURORA_CURTAINS = [
  { d: "M0,40 C60,10 120,70 200,36 C280,4 340,60 400,30 L400,140 C340,170 280,120 200,150 C120,180 60,120 0,150 Z", hue: "#7af0d0", delay: 0 },
  { d: "M0,70 C80,40 150,96 220,62 C300,28 350,84 400,58 L400,150 C340,176 300,130 220,160 C150,190 80,140 0,166 Z", hue: "#8db7f2", delay: -7 },
  { d: "M0,20 C70,50 140,0 210,30 C290,64 350,14 400,40 L400,110 C350,90 290,140 210,104 C140,72 70,124 0,96 Z", hue: "#b9a2f7", delay: -13 },
];

function Aurora() {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="size-full">
      <defs>
        {AURORA_CURTAINS.map((c, i) => (
          <linearGradient key={i} id={`expedition-aurora-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.hue} stopOpacity="0" />
            <stop offset="0.3" stopColor={c.hue} stopOpacity="0.85" />
            <stop offset="1" stopColor={c.hue} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {AURORA_CURTAINS.map((c, i) => (
        <path key={i} className="sky-aurora" d={c.d} fill={`url(#expedition-aurora-${i})`} style={{ animationDelay: `${c.delay}s` }} />
      ))}
    </svg>
  );
}

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

/** 魔導炉の炉心: 落ちた星が燃え、ルーンの魔法陣が巡る */
function ForgeCore({ color }: { color: string }) {
  return (
    <div className="relative size-full">
      <div
        className="sky-core-pulse absolute inset-[22%] rounded-full"
        style={{
          background: `radial-gradient(circle at 46% 44%, #fff4d8, ${color} 38%, color-mix(in srgb, ${color} 60%, #7a1d0c) 70%, transparent 72%)`,
          boxShadow: `0 0 12cqh 3cqh ${color}55, 0 0 40cqh 10cqh ${color}22`,
        }}
      />
      <svg viewBox="-100 -100 200 200" className="sky-core-ring absolute inset-0 size-full overflow-visible" fill="none" stroke={color}>
        <circle r={88} strokeWidth={0.8} opacity={0.5} />
        <circle r={78} strokeWidth={0.5} opacity={0.4} />
        <path id="expedition-core-rune-path" d="M0,-83 A83,83 0 1,1 -0.01,-83" stroke="none" />
        <text fontSize={7} fill={color} stroke="none" opacity={0.6} letterSpacing={3}>
          <textPath href="#expedition-core-rune-path">{RUNES + RUNES}</textPath>
        </text>
        {range(6).map((i) => {
          const pts = range(3).map((k) => polar(88, i * 20 + k * 120));
          return <path key={i} d={`M${pts.map(([x, y]) => `${x},${y}`).join(" L")} Z`} strokeWidth={0.4} opacity={0.22} />;
        })}
      </svg>
    </div>
  );
}

/** 星冠: 天に掛かる光輪と星の冠、そこから降りる光の柱 */
const CROWN_POINTS = range(12).map((i) => {
  const [x0, y0] = polar(70, i * 30 - 4), [x1, y1] = polar(i % 3 === 0 ? 98 : 86, i * 30), [x2, y2] = polar(70, i * 30 + 4);
  return `M${x0},${y0} L${x1},${y1} L${x2},${y2}`;
}).join(" ");

function StarCrown({ color }: { color: string }) {
  return (
    <div className="relative size-full">
      {/* 天から降りる光の柱 */}
      <div
        className="sky-crown-pillar absolute top-1/2 left-1/2 h-[600%] w-[34%] -translate-x-1/2"
        style={{ background: `linear-gradient(to bottom, ${color}55, ${color}18 40%, transparent 80%)`, filter: "blur(8px)" }}
      />
      <svg viewBox="-100 -100 200 200" className="sky-crown-turn absolute inset-0 size-full overflow-visible" fill="none" stroke={color}>
        <circle r={70} strokeWidth={2.2} opacity={0.75} />
        <circle r={62} strokeWidth={0.6} opacity={0.5} />
        <path d={CROWN_POINTS} strokeWidth={1} opacity={0.65} strokeLinejoin="round" />
        {range(12).map((i) => {
          const [x, y] = polar(i % 3 === 0 ? 98 : 86, i * 30);
          return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.6 : 1.6} fill={color} stroke="none" />;
        })}
      </svg>
      <div className="absolute inset-[18%] rounded-full" style={{ boxShadow: `0 0 10cqh 2cqh ${color}40, inset 0 0 6cqh 1cqh ${color}30` }} />
    </div>
  );
}

/**
 * ゆっくり瞬く明るい星。写真の星のように、小さな芯と柔らかな暈、ごく細い光の筋だけにする
 * （星空そのものは star-sky.tsx の canvas に描く）
 */
const TWINKLES = [
  { x: 0.14, y: 0.2, s: 1, d: 0, c: "#fff6ec" },
  { x: 0.38, y: 0.09, s: 0.7, d: -2.3, c: "#dfe7ff" },
  { x: 0.6, y: 0.3, s: 0.8, d: -4.1, c: "#ffe9cf" },
  { x: 0.9, y: 0.14, s: 1.1, d: -1.2, c: "#e3ecff" },
  { x: 0.26, y: 0.44, s: 0.55, d: -3.4, c: "#ffd9b4" },
];
function Twinkles() {
  return (
    <div className="relative size-full">
      {TWINKLES.map((t, i) => (
        <div
          key={i}
          className="sky-twinkle absolute"
          style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, width: `${t.s * 5}cqh`, height: `${t.s * 5}cqh`, transform: "translate(-50%, -50%)", animationDelay: `${t.d}s` }}
        >
          <div className="absolute inset-[30%] rounded-full" style={{ background: `radial-gradient(circle, ${t.c}cc, ${t.c}22 35%, transparent 70%)` }} />
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: `linear-gradient(to right, transparent, ${t.c}66 50%, transparent)` }} />
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: `linear-gradient(to bottom, transparent, ${t.c}66 50%, transparent)` }} />
          <div className="absolute top-1/2 left-1/2 size-[6%] min-h-[1.5px] min-w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      ))}
    </div>
  );
}

/** 星雲: 紫・青・桃色の淡い雲が空いっぱいに重なり、ごくゆっくり漂う */
const NEBULA_CLOUDS = [
  { x: 18, y: 30, w: 60, h: 40, c: "#7a3cff", o: 0.22, d: 0 },
  { x: 62, y: 18, w: 55, h: 36, c: "#2ad1c9", o: 0.12, d: -20 },
  { x: 78, y: 52, w: 50, h: 34, c: "#ff6fae", o: 0.12, d: -40 },
  { x: 40, y: 62, w: 70, h: 30, c: "#5a3cd8", o: 0.16, d: -10 },
];
function Nebula() {
  return (
    <div className="relative size-full overflow-hidden">
      {NEBULA_CLOUDS.map((n, i) => (
        <div
          key={i}
          className="sky-nebula absolute"
          style={{
            left: `${n.x - n.w / 2}%`,
            top: `${n.y - n.h / 2}%`,
            width: `${n.w}%`,
            height: `${n.h}%`,
            background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${n.c}, transparent 70%)`,
            opacity: n.o,
            filter: "blur(24px)",
            animationDelay: `${n.d}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 流れ星: ときおり空を斜めに横切る（詠唱に応えて星脈から零れる、刻の欠片） */
const METEORS = [
  { x: 70, y: 8, delay: -3 },
  { x: 40, y: 4, delay: -11 },
];
function Meteors() {
  return (
    <div className="relative size-full overflow-hidden">
      {METEORS.map((m, i) => (
        <div key={i} className="sky-meteor absolute" style={{ left: `${m.x}%`, top: `${m.y}%`, animationDelay: `${m.delay}s` }}>
          <div className="h-px w-[14cqh] origin-left" style={{ background: "linear-gradient(to right, #ffffff, #d9ccff88 30%, transparent)", boxShadow: "0 0 4px #ffffff" }} />
        </div>
      ))}
    </div>
  );
}

/**
 * 星々の間へ果てなく伸びる星天の塔。雲海から立ち上がる巨きな石の塔で、片側は陰に、もう片側は灯を受ける。
 * 段ごとに張り出しと狭間、脇には小塔、小さな窓に灯がともり、塔を巻く回廊の灯が昇っていく。
 * 上へ行くほど空に霞み、頂には光の輪が掛かり、そこから光が天へ昇る
 */
const TOWER_TOP = 110;
const TOWER_BASE = 700;
const towerHalf = (y: number) => 6 + 40 * ((y - TOWER_TOP) / (TOWER_BASE - TOWER_TOP)) ** 1.25;
const TOWER_LEDGES = range(10).map((i) => TOWER_BASE - 40 - i * 56);
const TOWER_WINDOWS = TOWER_LEDGES.flatMap((y, i) =>
  range(5).map((k) => {
    const half = towerHalf(y - 28);
    return {
      x: 100 + (rand(i * 11 + k, 70) - 0.5) * half * 1.5,
      y: y - 12 - rand(i * 11 + k, 71) * 34,
      on: rand(i * 11 + k, 72) > 0.35,
      warm: rand(i * 11 + k, 73) > 0.5,
    };
  }),
);
function SpiralTower({ color }: { color: string }) {
  const body = (() => {
    const left: string[] = [], right: string[] = [];
    for (let y = TOWER_TOP; y <= TOWER_BASE; y += 10) {
      left.push(`${(100 - towerHalf(y)).toFixed(1)},${y}`);
      right.unshift(`${(100 + towerHalf(y)).toFixed(1)},${y}`);
    }
    return `M${left.join(" L")} L${right.join(" L")} Z`;
  })();
  return (
    <svg viewBox="0 0 200 700" preserveAspectRatio="xMidYMax meet" className="size-full overflow-visible">
      <defs>
        {/* 左は陰、右は灯を受ける */}
        <linearGradient id="expedition-tower-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0c0722" />
          <stop offset="0.55" stopColor="#1a1240" />
          <stop offset="0.9" stopColor="#2b2060" />
          <stop offset="1" stopColor="#3b2d7a" />
        </linearGradient>
        {/* 上へ行くほど空に霞む */}
        <linearGradient id="expedition-tower-air" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1140" stopOpacity="0.92" />
          <stop offset="0.45" stopColor="#1b1140" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1b1140" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="expedition-tower-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="expedition-tower-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4a8c" stopOpacity="0" />
          <stop offset="0.4" stopColor="#5a4a8c" stopOpacity="0.75" />
          <stop offset="1" stopColor="#2a1f50" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* 頂から天へ昇る光 */}
      <path d="M97,60 L94,-500 L106,-500 L103,60 Z" fill="url(#expedition-tower-beam)" style={{ filter: "blur(3px)" }} />
      <g fill="url(#expedition-tower-shade)">
        <path d={body} />
        {/* 頂の尖塔 */}
        <path d={`M${100 - towerHalf(TOWER_TOP)},${TOWER_TOP} L100,30 L${100 + towerHalf(TOWER_TOP)},${TOWER_TOP} Z`} />
        {/* 段ごとの張り出しと狭間 */}
        {TOWER_LEDGES.map((y, i) => {
          const h = towerHalf(y) + 5;
          const teeth = range(Math.floor((h * 2) / 5)).map((k) => `M${(100 - h + k * 5).toFixed(1)},${y - 4} h2.6 v4 h-2.6 Z`).join(" ");
          return (
            <g key={i}>
              <path d={`M${100 - h},${y} L${100 + h},${y} L${100 + h - 2},${y + 4} L${100 - h + 2},${y + 4} Z`} />
              <path d={teeth} />
            </g>
          );
        })}
        {/* 脇の小塔 */}
        {[TOWER_LEDGES[1], TOWER_LEDGES[3], TOWER_LEDGES[6]].map((y, i) => {
          const side = i % 2 === 0 ? 1 : -1;
          const cx = 100 + side * (towerHalf(y) + 4);
          return <path key={i} d={`M${cx - 5},${y} V${y - 44} H${cx - 6} L${cx},${y - 62} L${cx + 6},${y - 44} H${cx + 5} V${y} Z`} />;
        })}
      </g>
      {/* 灯を受ける右の縁と、張り出しの縁 */}
      <path d={`M${(100 + towerHalf(TOWER_BASE)).toFixed(1)},${TOWER_BASE} ${range(60).map((k) => `L${(100 + towerHalf(TOWER_BASE - k * 10)).toFixed(1)},${TOWER_BASE - k * 10}`).join(" ")}`} fill="none" stroke={color} strokeWidth={0.8} opacity={0.35} />
      {TOWER_LEDGES.map((y, i) => (
        <path key={i} d={`M${100 - towerHalf(y) - 5},${y} L${100 + towerHalf(y) + 5},${y}`} stroke={color} strokeWidth={0.6} opacity={0.35} />
      ))}
      {/* 塔を巻いて昇る回廊の灯 */}
      {TOWER_LEDGES.map((y, i) => {
        const h = towerHalf(y - 28);
        return (
          <g key={i}>
            <path d={`M${100 - h},${y - 6} Q100,${y - 18} ${100 + h},${y - 46}`} fill="none" stroke={color} strokeWidth={0.6} opacity={0.3} />
            {range(4).map((k) => {
              const t = (k + 0.5) / 4;
              const x = 100 - h + 2 * h * t;
              const yy = (1 - t) ** 2 * (y - 6) + 2 * (1 - t) * t * (y - 18) + t * t * (y - 46);
              return <circle key={k} cx={x} cy={yy} r={0.9} fill={color} opacity={0.8} />;
            })}
          </g>
        );
      })}
      {/* 小さな窓の灯 */}
      {TOWER_WINDOWS.filter((w) => w.on).map((w, i) => (
        <rect key={i} x={w.x - 0.8} y={w.y - 1.4} width={1.6} height={2.8} rx={0.6} fill={w.warm ? "#ffd9a0" : color} opacity={0.85} />
      ))}
      {/* 上ほど空に霞む */}
      <path d={body} fill="url(#expedition-tower-air)" />
      {/* 頂の光の輪 */}
      <ellipse cx={100} cy={70} rx={22} ry={5} fill="none" stroke={color} strokeWidth={1} opacity={0.65} />
      <ellipse cx={100} cy={70} rx={30} ry={7} fill="none" stroke={color} strokeWidth={0.5} opacity={0.3} />
      <circle cx={100} cy={34} r={2.4} fill="#ffffff" opacity={0.9} />
      <circle cx={100} cy={34} r={8} fill={color} opacity={0.25} />
      {/* 足元を包む雲海 */}
      <ellipse cx={100} cy={690} rx={130} ry={60} fill="url(#expedition-tower-cloud)" />
      <ellipse cx={40} cy={672} rx={60} ry={26} fill="url(#expedition-tower-cloud)" />
      <ellipse cx={168} cy={668} rx={56} ry={24} fill="url(#expedition-tower-cloud)" />
    </svg>
  );
}

/** 月: 縁へ向けて少し暗くし、淡い海の影を重ねる */
function Moon({ color }: { color: string }) {
  return (
    <div
      className="size-full rounded-full"
      style={{
        background: `radial-gradient(circle at 34% 40%, #0000000d 0 8%, transparent 13%), radial-gradient(circle at 60% 62%, #0000000b 0 10%, transparent 17%), radial-gradient(circle at 62% 32%, #00000008 0 5%, transparent 10%), radial-gradient(circle at 42% 40%, #fffef6, ${color} 60%, color-mix(in srgb, ${color} 70%, #6b6a80) 100%)`,
        boxShadow: `0 0 8cqh 2cqh ${color}33, 0 0 26cqh 6cqh ${color}14`,
        filter: "blur(0.6px)",
      }}
    />
  );
}

export function SkyObject({ object }: { object: ExpeditionCelestial }) {
  const { kind, x, y, size, color } = object;
  if (kind === "starsky") {
    return (
      <div className="pointer-events-none absolute inset-0">
        <StarSky seed={object.seed ?? 1} density={object.density ?? 1} milkyWay={object.milkyWay} milkyGlow={object.milkyGlow} />
      </div>
    );
  }
  // 縦長の舞台（スマホ）で大きくなりすぎないよう、幅と高さの小さい方に合わせる。オーロラと銀河は空いっぱいに広げる
  const wide = kind === "aurora" || kind === "twinkles" || kind === "nebula" || kind === "meteor";
  const tall = kind === "spire";
  const style: CSSProperties = wide
    ? { left: 0, right: 0, top: `${y * 100}%`, height: `${size * 100}%` }
    : tall
      ? { left: `${x * 100}%`, bottom: `${y * 100}%`, height: `${size * 100}%`, aspectRatio: "2 / 7", maxWidth: "30cqw", transform: "translateX(-50%)" }
      : {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: `min(${size * 100}cqh, ${size * 120}cqw)`,
          height: `min(${size * 100}cqh, ${size * 120}cqw)`,
          transform: "translate(-50%, -50%)",
        };
  return (
    <div className="pointer-events-none absolute" style={style}>
      {kind === "moon" && <Moon color={color} />}
      {kind === "astrolabe" && <Astrolabe color={color} />}
      {kind === "aurora" && <Aurora />}
      {kind === "core" && <ForgeCore color={color} />}
      {kind === "crown" && <StarCrown color={color} />}
      {kind === "twinkles" && <Twinkles />}
      {kind === "spire" && <SpiralTower color={color} />}
      {kind === "nebula" && <Nebula />}
      {kind === "meteor" && <Meteors />}
    </div>
  );
}
