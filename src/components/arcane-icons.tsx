// マホログの記号体系: 1px の幾何学ラインアートで描くインライン SVG。
// 線は vector-effect: non-scaling-stroke で、どの大きさでも 1px の細さを保つ。色は currentColor を受け継ぐ。
import type { CSSProperties, ReactNode, SVGProps } from "react";
import { RANKS } from "@/lib/game";
import { cn } from "@/lib/utils";

type IconProps = { className?: string; title?: string };

/** 1px の線で描くための共通属性 */
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} satisfies SVGProps<SVGElement>;

function Svg({ viewBox, className, title, children }: IconProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/** 極座標（度。0° が上、時計回り）→ 直交座標 */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

/** 中心 (cx, cy)・半径 r の正 n 角形（startDeg の向きに頂点） */
function polygon(cx: number, cy: number, r: number, n: number, startDeg = 0) {
  return Array.from({ length: n }, (_, i) => polar(cx, cy, r, startDeg + (360 / n) * i).join(",")).join(" ");
}

/** アプリの象徴: 1px の二重円に正三角形を内接させ、中央に小さな星の灯をともす */
export function ArcaneLogo({ className, title }: IconProps) {
  return (
    <Svg viewBox="0 0 48 48" className={className} title={title}>
      <circle cx="24" cy="24" r="22" {...line} opacity={0.55} />
      <circle cx="24" cy="24" r="19" {...line} />
      <polygon points={polygon(24, 24, 19, 3)} {...line} />
      <circle cx="24" cy="24" r="4.5" fill="currentColor" opacity={0.18} />
      <circle cx="24" cy="24" r="1.6" fill="currentColor" />
    </Svg>
  );
}

/** 四芒星 ✦ の代わりに使う、細く尖った星の灯 */
export function Sparkle({ className, title }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" className={className} title={title}>
      <path d="M12 2C12.6 9 15 11.4 22 12C15 12.6 12.6 15 12 22C11.4 15 9 12.6 2 12C9 11.4 11.4 9 12 2Z" fill="currentColor" />
    </Svg>
  );
}

/** 「科目 ➔ 詳細」をつなぐ細い矢印 */
export function ArrowGlyph({ className, title }: IconProps) {
  return (
    <Svg viewBox="0 0 16 16" className={cn("inline-block size-[0.9em] align-[-0.1em]", className)} title={title}>
      <path d="M2.5 8H13M9.5 4.5L13 8L9.5 11.5" {...line} />
    </Svg>
  );
}

/**
 * 魔術階級の印。階級が上がるごとに幾何学の層が一つずつ組み上がっていく（I は円と灯だけ、X で完成）。
 * animate なら、層を内側から順に線で描き起こす（昇格の演出用）
 */
export function RankSigil({ numeral, animate = false, className }: { numeral: string; animate?: boolean; className?: string }) {
  const tier = Math.max(1, RANKS.findIndex((r) => r.numeral === numeral) + 1);
  const c = 32;
  // 描き起こす演出では pathLength で線の長さを揃えるため non-scaling-stroke を外し、表示幅（size-24）で約 1px の太さにする
  const stroke = animate ? { ...line, vectorEffect: undefined, strokeWidth: 0.67 } : line;
  const layers: ReactNode[] = [
    // I: 内なる円と、中央の灯
    <>
      <circle cx={c} cy={c} r={9} {...stroke} pathLength={1} />
      <circle cx={c} cy={c} r={1.4} fill="currentColor" />
    </>,
    // II: 正三角形
    <polygon key="triangle" points={polygon(c, c, 17, 3)} {...stroke} pathLength={1} />,
    // III: 逆三角形を重ねて六芒星に
    <polygon key="inverted" points={polygon(c, c, 17, 3, 180)} {...stroke} pathLength={1} />,
    // IV: 外周の円
    <circle key="outer" cx={c} cy={c} r={23} {...stroke} pathLength={1} />,
    // V: 斜めに置いた正方形（星の座標）
    <polygon key="square" points={polygon(c, c, 23, 4, 45)} {...stroke} opacity={0.6} pathLength={1} />,
    // VI: 外周の十二の刻み
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(c, c, 23, i * 30);
        const [x2, y2] = polar(c, c, 26, i * 30);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...stroke} pathLength={1} />;
      })}
    </>,
    // VII: 六芒星の頂に灯る六つの星
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y] = polar(c, c, 17, i * 60);
        return <circle key={i} cx={x} cy={y} r={1.2} fill="currentColor" />;
      })}
    </>,
    // VIII: 破線の天球の輪
    <circle key="dashed" cx={c} cy={c} r={28.5} {...stroke} strokeDasharray="1 3" opacity={0.7} />,
    // IX: 四方と四隅へ伸びる光条と、内側の小さな輪
    <>
      <circle cx={c} cy={c} r={4.5} {...stroke} pathLength={1} />
      {Array.from({ length: 8 }, (_, i) => {
        const [x1, y1] = polar(c, c, 26, i * 45);
        const [x2, y2] = polar(c, c, i % 2 === 0 ? 31 : 29.5, i * 45);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...stroke} pathLength={1} />;
      })}
    </>,
    // X: 中央の灯が四芒星となって輝き、印が完成する
    <>
      <circle cx={c} cy={c} r={6} fill="currentColor" opacity={0.16} />
      <path
        d={`M${c} ${c - 6}C${c + 0.4} ${c - 1.6} ${c + 1.6} ${c - 0.4} ${c + 6} ${c}C${c + 1.6} ${c + 0.4} ${c + 0.4} ${c + 1.6} ${c} ${c + 6}C${c - 0.4} ${c + 1.6} ${c - 1.6} ${c + 0.4} ${c - 6} ${c}C${c - 1.6} ${c - 0.4} ${c - 0.4} ${c - 1.6} ${c} ${c - 6}Z`}
        fill="currentColor"
      />
    </>,
  ];

  return (
    <Svg viewBox="0 0 64 64" className={className} title={`魔術階級 ${numeral}`}>
      {layers.slice(0, tier).map((layer, i) => (
        <g
          key={i}
          className={animate ? "sigil-layer" : undefined}
          // 最も新しく組み上がった層を、少しだけ明るく
          opacity={i === tier - 1 || tier === 1 ? 1 : 0.75}
          style={{ "--i": i } as CSSProperties}
        >
          {layer}
        </g>
      ))}
    </Svg>
  );
}

/** プロフィールの紋章（avatar_url のプリセットID → 1px のラインアート） */
const AVATAR_GLYPHS: Record<string, ReactNode> = {
  // 星詠みの帽子
  "wizard-1": (
    <>
      <path d="M7 17.2L12.4 4.6L17 17.2" {...line} />
      <ellipse cx="12" cy="17.6" rx="7.2" ry="1.7" {...line} />
      <path d="M17.6 6.2C17.7 7.4 18.1 7.8 19.3 7.9C18.1 8 17.7 8.4 17.6 9.6C17.5 8.4 17.1 8 15.9 7.9C17.1 7.8 17.5 7.4 17.6 6.2Z" fill="currentColor" />
    </>
  ),
  // 三日月と星
  "wizard-2": (
    <>
      <path d="M14.5 5.2A7.2 7.2 0 1 0 14.5 18.8A5.6 5.6 0 1 1 14.5 5.2Z" {...line} />
      <path d="M17.8 9.4C17.9 10.6 18.3 11 19.5 11.1C18.3 11.2 17.9 11.6 17.8 12.8C17.7 11.6 17.3 11.2 16.1 11.1C17.3 11 17.7 10.6 17.8 9.4Z" fill="currentColor" />
    </>
  ),
  // 梟
  "wizard-3": (
    <>
      <path d="M6 8.2Q12 4.4 18 8.2V14.6Q12 21 6 14.6Z" {...line} />
      <path d="M6.6 6.2L8.6 8.6M17.4 6.2L15.4 8.6" {...line} />
      <circle cx="9.3" cy="11.2" r="2.3" {...line} />
      <circle cx="14.7" cy="11.2" r="2.3" {...line} />
      <circle cx="9.3" cy="11.2" r="0.7" fill="currentColor" />
      <circle cx="14.7" cy="11.2" r="0.7" fill="currentColor" />
      <path d="M11.3 13.6L12 15L12.7 13.6" {...line} />
    </>
  ),
  // 黒猫
  "wizard-4": (
    <>
      <path d="M6.2 9.4L7.2 4.4L10.6 7.2Q12 6.8 13.4 7.2L16.8 4.4L17.8 9.4Q18.8 16.4 12 18.2Q5.2 16.4 6.2 9.4Z" {...line} />
      <ellipse cx="9.5" cy="11.6" rx="0.6" ry="1.3" fill="currentColor" />
      <ellipse cx="14.5" cy="11.6" rx="0.6" ry="1.3" fill="currentColor" />
      <path d="M11.4 14.2L12 14.8L12.6 14.2" {...line} />
    </>
  ),
  // 竜の瞳
  "wizard-5": (
    <>
      <path d="M3.4 12Q12 3.6 20.6 12Q12 20.4 3.4 12Z" {...line} />
      <circle cx="12" cy="12" r="3.8" {...line} />
      <ellipse cx="12" cy="12" rx="0.8" ry="3" fill="currentColor" />
    </>
  ),
};

export function AvatarGlyph({ avatar, className }: { avatar: string; className?: string }) {
  return (
    <Svg viewBox="0 0 24 24" className={className}>
      {AVATAR_GLYPHS[avatar] ?? AVATAR_GLYPHS["wizard-1"]}
    </Svg>
  );
}
