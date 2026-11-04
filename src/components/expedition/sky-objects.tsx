import type { CSSProperties } from "react";
import type { ExpeditionCelestial } from "@/lib/expedition";

/**
 * 探索の景色の空に掛かる、流れない大きな物（月・天文盤・オーロラ・炉心・星冠・銀河・螺旋の塔）。
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

/** 天文盤の外周の歯。ところどころ欠けている（刻の崩壊で、世界の暦の歯が欠けていった） */
const GEAR_TEETH = range(72)
  .filter((i) => !(i % 9 === 4 || rand(i, 1) > 0.86))
  .map((i) => {
    const a = i * 5;
    const [x1, y1] = polar(92, a - 1.4), [x2, y2] = polar(99, a - 1), [x3, y3] = polar(99, a + 1), [x4, y4] = polar(92, a + 1.4);
    return `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`;
  })
  .join(" ");
const ASTRO_TICKS = range(120)
  .map((i) => {
    const [x1, y1] = polar(i % 10 === 0 ? 70 : 74, i * 3), [x2, y2] = polar(78, i * 3);
    return `M${x1},${y1} L${x2},${y2}`;
  })
  .join(" ");
/** 十二の宮の区切りと、それぞれの小さな印 */
const ZODIAC = range(12).map((i) => ({ line: [polar(60, i * 30), polar(70, i * 30)] as const, mark: polar(65, i * 30 + 15) }));
/** 星を指す網（レテ）の爪 */
const RETE = [20, 75, 140, 200, 255, 320].map((a, i) => {
  const [x0, y0] = polar(30, a), [cx, cy] = polar(48, a + 18), [x1, y1] = polar(56 - (i % 3) * 4, a + 30);
  return { d: `M${x0},${y0} Q${cx},${cy} ${x1},${y1}`, tip: [x1, y1] as const };
});

function Astrolabe({ color }: { color: string }) {
  return (
    <div className="relative size-full">
      {/* 動かない外周の歯車 */}
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full overflow-visible" fill="none" stroke={color} opacity={0.5}>
        <path d={GEAR_TEETH} fill={color} stroke="none" opacity={0.55} />
        <circle r={92} strokeWidth={1.4} />
      </svg>
      {/* ゆっくり回る目盛りの環・十二の宮・黄道・星を指す網（箱ごと回すので、中心はずれない） */}
      <div className="sky-astrolabe-turn absolute inset-0">
        <svg viewBox="-100 -100 200 200" className="size-full overflow-visible" fill="none" stroke={color} opacity={0.55}>
          <circle r={78} strokeWidth={0.8} />
          <path d={ASTRO_TICKS} strokeWidth={0.5} />
          <circle r={70} strokeWidth={0.5} />
          <circle r={60} strokeWidth={0.6} />
          {ZODIAC.map(({ line: [[x1, y1], [x2, y2]], mark: [mx, my] }, i) => (
            <g key={i}>
              <path d={`M${x1},${y1} L${x2},${y2}`} strokeWidth={0.5} />
              <circle cx={mx} cy={my} r={i % 3 === 0 ? 1.6 : 1} strokeWidth={0.5} />
            </g>
          ))}
          <circle cy={-14} r={40} strokeWidth={0.7} />
          {RETE.map(({ d, tip: [x, y] }, i) => (
            <g key={i}>
              <path d={d} strokeWidth={0.7} />
              <circle cx={x} cy={y} r={1.4} fill={color} stroke="none" />
            </g>
          ))}
          <path d="M0,-92 L0,92 M-92,0 L92,0" strokeWidth={0.35} />
        </svg>
      </div>
      {/* 中心の小さな環は逆へ回る */}
      <div className="sky-astrolabe-turn-back absolute inset-[34%]">
        <svg viewBox="-32 -32 64 64" className="size-full overflow-visible" fill="none" stroke={color} opacity={0.4}>
          <circle r={30} strokeWidth={0.6} />
          <path d="M0,-30 L0,-6 M0,6 L0,30 M-30,0 L-6,0 M6,0 L30,0" strokeWidth={0.6} />
        </svg>
      </div>
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full">
        <circle r={3} fill={color} opacity={0.7} />
      </svg>
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

/** 正規分布に近い乱数（帯の中ほどに星を集める） */
const gauss = (i: number, salt: number) => (rand(i, salt) + rand(i, salt + 1) + rand(i, salt + 2) - 1.5) / 1.5;
const GALAXY_TINTS = ["#fff6ec", "#dfe7ff", "#ffe3c4", "#eddcff", "#cdeeff"];
/** 銀河の帯に集まる無数の星（帯の中心ほど密に） */
const GALAXY_STARS = range(420).map((i) => {
  const along = rand(i, 3);
  const across = gauss(i, 10) * (0.9 - Math.abs(along - 0.5) * 0.6);
  return {
    x: along * 1000,
    y: 200 + across * 120,
    r: 0.25 + rand(i, 5) ** 3 * 1.4,
    o: 0.35 + rand(i, 6) * 0.6,
    tint: GALAXY_TINTS[i % GALAXY_TINTS.length],
  };
});
/** 光の筋を持つ明るい星（ゆっくり瞬く） */
const BRIGHT_STARS = [
  { x: 0.14, y: 0.22, s: 1, d: 0 },
  { x: 0.36, y: 0.1, s: 0.7, d: -2.3 },
  { x: 0.58, y: 0.28, s: 0.85, d: -4.1 },
  { x: 0.9, y: 0.12, s: 1.1, d: -1.2 },
  { x: 0.27, y: 0.42, s: 0.6, d: -3.4 },
  { x: 0.72, y: 0.06, s: 0.65, d: -5.2 },
];

/**
 * 斜めに渡る銀河。淡く広い光、明るい芯、芯を割る暗い塵の筋を重ね、無数の星を帯に集める。
 * 光の筋を持つ明るい星がいくつか、ゆっくり瞬く
 */
function Galaxy({ color }: { color: string }) {
  return (
    <div className="relative size-full">
      <div className="absolute inset-[-20%]" style={{ transform: "rotate(-20deg)" }}>
        <div
          className="absolute inset-x-0 top-[30%] h-[40%]"
          style={{ background: `radial-gradient(ellipse 55% 50% at 55% 50%, ${color}38, ${color}12 55%, transparent 75%)`, filter: "blur(18px)" }}
        />
        <div
          className="absolute inset-x-[12%] top-[43%] h-[14%]"
          style={{ background: "radial-gradient(ellipse 50% 50% at 55% 50%, #fff4e6aa, #e8d8ff44 45%, transparent 75%)", filter: "blur(10px)" }}
        />
        {/* 芯を割る暗い塵の筋 */}
        <div
          className="absolute inset-x-[20%] top-[48.5%] h-[3.5%]"
          style={{ background: "radial-gradient(ellipse 50% 50% at 50% 50%, #05031299, transparent 75%)", filter: "blur(5px)", transform: "rotate(1.5deg)" }}
        />
        <div
          className="absolute inset-x-[34%] top-[46%] h-[2.5%]"
          style={{ background: "radial-gradient(ellipse 50% 50% at 50% 50%, #05031277, transparent 75%)", filter: "blur(4px)", transform: "rotate(-2deg)" }}
        />
        <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-x-0 top-[25%] h-[50%] w-full">
          {GALAXY_STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.tint} opacity={s.o} />
          ))}
        </svg>
      </div>
      {BRIGHT_STARS.map((b, i) => (
        <div
          key={i}
          className="sky-twinkle absolute"
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.s * 3.2}cqh`, height: `${b.s * 3.2}cqh`, transform: "translate(-50%, -50%)", animationDelay: `${b.d}s` }}
        >
          <svg viewBox="-20 -20 40 40" className="size-full overflow-visible">
            <circle r={6} fill={GALAXY_TINTS[i % GALAXY_TINTS.length]} opacity={0.12} />
            <path d="M0,-20 L0.7,-0.7 L20,0 L0.7,0.7 L0,20 L-0.7,0.7 L-20,0 L-0.7,-0.7 Z" fill={GALAXY_TINTS[i % GALAXY_TINTS.length]} opacity={0.9} />
            <circle r={1.6} fill="#ffffff" />
          </svg>
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
  // 縦長の舞台（スマホ）で大きくなりすぎないよう、幅と高さの小さい方に合わせる。オーロラと銀河は空いっぱいに広げる
  const wide = kind === "aurora" || kind === "galaxy" || kind === "nebula" || kind === "meteor";
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
      {kind === "galaxy" && <Galaxy color={color} />}
      {kind === "spire" && <SpiralTower color={color} />}
      {kind === "nebula" && <Nebula />}
      {kind === "meteor" && <Meteors />}
    </div>
  );
}
