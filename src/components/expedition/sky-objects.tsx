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
    <svg viewBox="-100 -100 200 200" className="size-full overflow-visible" fill="none" stroke={color}>
      <g opacity={0.5}>
        <path d={GEAR_TEETH} fill={color} stroke="none" opacity={0.55} />
        <circle r={92} strokeWidth={1.4} />
      </g>
      <g className="sky-astrolabe-turn" opacity={0.55}>
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
        {/* 黄道の輪（中心からずれた円）と、星を指す網 */}
        <circle cy={-14} r={40} strokeWidth={0.7} />
        {RETE.map(({ d, tip: [x, y] }, i) => (
          <g key={i}>
            <path d={d} strokeWidth={0.7} />
            <circle cx={x} cy={y} r={1.4} fill={color} stroke="none" />
          </g>
        ))}
        <path d="M0,-92 L0,92 M-92,0 L92,0" strokeWidth={0.35} />
      </g>
      <g className="sky-astrolabe-turn-back" opacity={0.4}>
        <circle r={30} strokeWidth={0.6} />
        <path d="M0,-30 L0,-6 M0,6 L0,30 M-30,0 L-6,0 M6,0 L30,0" strokeWidth={0.6} />
      </g>
      <circle r={3} fill={color} stroke="none" opacity={0.7} />
    </svg>
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

/** 斜めに渡る銀河。ぼかした光の帯に、細かな星を散らす */
const GALAXY_DUST = range(90).map((i) => {
  const t = rand(i, 3);
  const spread = (rand(i, 4) - 0.5) * (18 + 20 * Math.sin(t * Math.PI));
  return { x: t * 400, y: 100 + spread, r: 0.3 + rand(i, 5) * 0.9, o: 0.3 + rand(i, 6) * 0.6 };
});

function Galaxy({ color }: { color: string }) {
  return (
    <div className="relative size-full" style={{ transform: "rotate(-18deg)" }}>
      <div
        className="absolute inset-x-0 top-[38%] h-[24%]"
        style={{ background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${color}40, ${color}14 55%, transparent 75%)`, filter: "blur(10px)" }}
      />
      <div className="absolute inset-x-[15%] top-[45%] h-[10%]" style={{ background: `radial-gradient(ellipse 50% 50% at 50% 50%, #fff6ff33, transparent 70%)`, filter: "blur(6px)" }} />
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-0 size-full">
        {GALAXY_DUST.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f4f0ff" opacity={s.o} />
        ))}
      </svg>
    </div>
  );
}

/** 星々の間へ果てなく伸びる螺旋の塔（星天の塔）。上は空に溶ける */
function SpiralTower({ color }: { color: string }) {
  const turns = range(14);
  return (
    <svg viewBox="0 0 100 400" preserveAspectRatio="xMidYMax meet" className="size-full">
      <defs>
        <linearGradient id="expedition-tower-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1d5c" stopOpacity="0" />
          <stop offset="0.35" stopColor="#2a1d5c" stopOpacity="0.8" />
          <stop offset="1" stopColor="#1a1240" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M38,400 L42,40 L50,0 L58,40 L62,400 Z" fill="url(#expedition-tower-fade)" />
      {/* 塔を巻いて昇る階段と、ところどころ灯る窓 */}
      {turns.map((i) => {
        const y = 390 - i * 27;
        const w = 12 + (y / 400) * 8;
        return (
          <g key={i} opacity={Math.min(1, y / 260)}>
            <path d={`M${50 - w},${y} Q50,${y - 8} ${50 + w},${y - 14}`} fill="none" stroke={color} strokeWidth={0.8} opacity={0.7} />
            {rand(i, 7) > 0.4 && <rect x={48.6} y={y - 9} width={2.8} height={4} rx={1} fill={color} opacity={0.75} />}
          </g>
        );
      })}
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
  const wide = kind === "aurora" || kind === "galaxy";
  const tall = kind === "spire";
  const style: CSSProperties = wide
    ? { left: 0, right: 0, top: `${y * 100}%`, height: `${size * 100}%` }
    : tall
      ? { left: `${x * 100}%`, bottom: `${y * 100}%`, height: `${size * 100}%`, aspectRatio: "1 / 4", transform: "translateX(-50%)" }
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
    </div>
  );
}
