import { useId, type CSSProperties } from "react";

const SPARKS = Array.from({ length: 6 }, (_, i) => ({ delay: -i * 0.37, drift: 0.6 + ((i * 37) % 10) / 20 }));

type Pt = readonly [x: number, y: number, width: number];
const f = (n: number) => +n.toFixed(2);

/** 点を通るなめらかな線（Catmull-Rom を3次ベジェにしたもの）。先頭の点への移動は含まない */
function smooth(pts: (readonly [number, number])[]) {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

/** 芯の点と幅から、垂れる房の形（左右の縁をなめらかに結んだ帯）を作る */
function ribbon(pts: Pt[]) {
  const left = pts.map(([x, y, w]) => [x - w / 2, y] as const);
  const right = pts.map(([x, y, w]) => [x + w / 2, y] as const).reverse();
  return `M${f(left[0][0])},${f(left[0][1])}${smooth(left)} L${f(right[0][0])},${f(right[0][1])}${smooth(right)} Z`;
}

/**
 * 髪の房。付け根（root）から中ほど（mid）までと、中ほどから毛先までに分け、毛先は付け根より遅れて揺れるので、房がしなって見える。
 * 二つの部分は継ぎ目で重ねる。delay は房ごとの揺れの遅れ（外の房ほど遅れる）
 */
const STRANDS = (
  [
    { up: [[24.6, 39, 2.8], [23.9, 45, 3], [22.9, 50.4, 2.8]], low: [[22.95, 49.6, 2.8], [21.6, 54.2, 2], [19.2, 58.2, 0.2]], delay: -0.5, sheen: true },
    { up: [[26.4, 40, 2.6], [25.8, 46, 2.8], [25.2, 51.2, 2.6]], low: [[25.25, 50.4, 2.6], [24.5, 55.8, 1.8], [22.6, 60.6, 0.2]], delay: -0.42, sheen: true },
    { up: [[28, 41, 2.2], [27.6, 47, 2.4], [27.4, 52.2, 2.2]], low: [[27.4, 51.4, 2.2], [27.1, 56.2, 1.6], [26.2, 60.8, 0.2]], delay: -0.36, sheen: true },
    { up: [[29.4, 40.4, 1.6], [29.2, 45, 1.6], [28.85, 49.2, 1.4]], low: [[28.85, 48.6, 1.4], [28.6, 52.4, 1], [27.9, 55.8, 0.15]], delay: -0.3, sheen: true },
  ] satisfies { up: Pt[]; low: Pt[]; delay: number; sheen: boolean }[]
).map((h) => ({
  root: h.up[0],
  mid: h.low[0],
  delay: h.delay,
  upper: ribbon(h.up),
  lower: ribbon(h.low),
  // 艶の筋は毛先側の芯に沿って細く引く
  sheen: h.sheen ? `M${f(h.up[1][0] + 0.3)},${h.up[1][1]}${smooth([[h.up[1][0] + 0.3, h.up[1][1]], ...h.low.slice(0, 2).map(([x, y]) => [x + 0.2, y] as const)])}` : undefined,
}));

/**
 * 腰から垂れる三枚の布（奥から: 後ろへ長く垂れる布・中の布・前の短い布）。
 * 布は split の高さで上と下（裾）に分け、上は腰（31, 55）を軸にわずかに、裾は split の点を軸に遅れて翻るので、布がしなって見える。
 * 上と下は継ぎ目で重ねて描く。lit は灯を受ける裾の縁の明るさ。前の布ほど明るい
 */
const SKIRT = [
  {
    className: "wander-skirt-back",
    body: "M28,55 C26,61.6 22.6,71.4 19.4,81.4 C18.4,84.8 17.4,87.8 16.6,90.6 C18.2,89.6 19.4,90.8 20.8,90.2 C22.4,89.4 23.2,87.4 24.4,85.8 C25.4,84.4 26.2,83 27,81.6 L31.4,56.4 Z",
    hem: "M16.6,90.6 C18.2,89.6 19.4,90.8 20.8,90.2 C22.4,89.4 23.2,87.4 24.4,85.8 C25.4,84.4 26.2,83 27,81.6",
    fold: "M27.2,58.4 C25.4,66 23,75 20.6,86.4",
    split: [26.6, 70],
    lit: 0.45,
  },
  {
    className: "wander-skirt-mid",
    body: "M29.4,55.4 C28.2,62 26.4,71.2 24.6,81.8 C25.8,81.2 26.8,82.2 27.8,81.2 C29,79.8 29.8,78 30.8,76.4 C31.6,75.2 32.4,74.2 33.2,73.2 L34,57 Z",
    hem: "M24.6,81.8 C25.8,81.2 26.8,82.2 27.8,81.2 C29,79.8 29.8,78 30.8,76.4 C31.6,75.2 32.4,74.2 33.2,73.2",
    fold: "M30.8,58.6 C29.4,65 27.8,72 26.4,80.4",
    split: [30.2, 70],
    lit: 0.52,
  },
  {
    className: "wander-skirt-front",
    body: "M32.6,55.2 C34.6,58.4 36.4,61.8 37.6,64.8 C38.1,66.4 37.7,68 36.7,69.2 C35.1,70.6 33.4,71.8 32,73.4 C31.2,74.4 30.4,75.6 29.6,76.8 C29.8,70 30.2,63 30.6,56.4 Z",
    hem: "M37.6,64.8 C38.1,66.4 37.7,68 36.7,69.2 C35.1,70.6 33.4,71.8 32,73.4 C31.2,74.4 30.4,75.6 29.6,76.8",
    fold: "M33.6,58.6 C33.6,63 33,67.6 32,72",
    split: [33.6, 63.6],
    lit: 0.62,
  },
];

/**
 * 腿・脛・足に分けた脚。腿は腰（cx, 66）、脛は膝（cx, 80）、足は足首（cx, 94.5）で曲がる。
 * 腿は付け根ほど太く膝へ締まり、脛は後ろにふくらはぎの丸みを持つ。膝下までのロングブーツは履き口が膝で開き、
 * つま先は細く尖り、踵は細いピンヒールで土踏まずが高く浮く。lit は杖の灯を受ける前の縁の明るさ
 */
function Leg({ side, cx, lit }: { side: "front" | "back"; cx: number; lit: number }) {
  const at = (dx: number, y: number) => `${+(cx + dx).toFixed(2)},${y}`;
  return (
    <g className={`wander-thigh wander-${side}`} style={{ transformOrigin: `${cx}px 66px` }}>
      <path d={`M${at(-2.3, 63)} C${at(-2.5, 69)} ${at(-1.8, 75.5)} ${at(-1.3, 80)} L${at(1.3, 80)} C${at(1.8, 75)} ${at(2.5, 69.5)} ${at(2.3, 63)} Z`} />
      <path d={`M${at(2.3, 66)} C${at(2.3, 70)} ${at(1.8, 75)} ${at(1.3, 79.4)}`} fill="none" stroke="var(--wander-glow)" strokeWidth={0.3} opacity={lit} />
      <g className={`wander-shin wander-${side}`} style={{ transformOrigin: `${cx}px 80px` }}>
        <circle cx={cx} cy={80} r={1.35} />
        {/* ブーツの筒。履き口は膝で外へ開き、後ろはふくらはぎの丸みに沿って足首へ細る */}
        <path d={`M${at(-2.2, 79.1)} L${at(2.1, 78.7)} L${at(1.75, 81.6)} C${at(1.6, 85.6)} ${at(1.25, 90.6)} ${at(1.05, 94.6)} L${at(-1.1, 94.6)} C${at(-1.3, 91.4)} ${at(-2.35, 87)} ${at(-2, 82.6)} L${at(-1.9, 81.7)} Z`} />
        <path d={`M${at(-2.2, 79.1)} L${at(2.1, 78.7)}`} fill="none" stroke="var(--wander-glow)" strokeWidth={0.32} opacity={lit * 1.6} />
        <path d={`M${at(1.75, 81.8)} C${at(1.6, 85.6)} ${at(1.25, 90.6)} ${at(1.05, 94.4)}`} fill="none" stroke="var(--wander-glow)" strokeWidth={0.26} opacity={lit} />
        <g className={`wander-foot wander-${side}`} style={{ transformOrigin: `${cx}px 94.5px` }}>
          {/* 足先: 甲はなだらかに下り、つま先は細く尖る。土踏まずは高く浮き、踵は細いピンヒール */}
          <path
            d={`M${at(-1.1, 90.8)} L${at(1.1, 90.8)} L${at(1.3, 93)} C${at(2.6, 93.5)} ${at(4.6, 94.8)} ${at(6.3, 95.9)} C${at(6.6, 96.2)} ${at(6.2, 96.6)} ${at(5.6, 96.6)} L${at(2.8, 96.6)} C${at(1.4, 96.6)} ${at(0.2, 95.4)} ${at(-0.8, 95.2)} L${at(-1.15, 96.6)} L${at(-1.75, 96.6)} L${at(-1.7, 94.2)} C${at(-1.6, 93)} ${at(-1.35, 91.8)} ${at(-1.1, 90.8)} Z`}
          />
        </g>
      </g>
    </g>
  );
}

/**
 * 大きな魔法帽を被り、杖を携えた魔術師の影絵。右を向いて胸を張り、顎を上げて歩む。
 * すらりと背が高く、細い腰をコルセットの帯で締め、肩には金具の肩当て、前の割れた長い裾から脚がのぞく。
 * 歩みは舞台の [data-walking] で動き（脚の振り・体の上下・外套の揺れ・杖先から零れる光）、
 * 歩みを止めると脚を揃えて立ち止まる。glow は杖先の灯と縁取りの色。灯は右（杖）から差すので、前の縁ほど明るく縁取る
 */
export function Wanderer({ glow, className, style }: { glow: string; className?: string; style?: CSSProperties }) {
  const orbId = useId();
  const liningId = useId();
  const clipId = useId();
  return (
    <div className={className} style={{ ...style, "--wander-glow": glow } as CSSProperties} aria-hidden>
      <svg viewBox="0 0 60 100" className="h-full w-full overflow-visible" fill="#04050b">
        <defs>
          <radialGradient id={orbId}>
            <stop offset="0" stopColor={glow} stopOpacity="0.9" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
          {/* マントの裏地: 杖の灯がわずかに回り込み、裾ほど暗い */}
          <linearGradient id={liningId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0e1c" />
            <stop offset="1" stopColor="#06070e" />
          </linearGradient>
          {/* 腰布の上と裾を分ける切り取り（継ぎ目が見えないよう 1.5 ずつ重ねる） */}
          {SKIRT.map((p, i) => (
            <g key={i}>
              <clipPath id={`${clipId}-u${i}`}>
                <rect x={0} y={0} width={60} height={p.split[1] + 1.5} />
              </clipPath>
              <clipPath id={`${clipId}-l${i}`}>
                <rect x={0} y={p.split[1] - 1.5} width={60} height={100} />
              </clipPath>
            </g>
          ))}
        </defs>
        {/* 足元に落ちる影 */}
        <ellipse cx={30} cy={96.8} rx={13} ry={1.2} fill="#000" opacity={0.45} />
        <g className="wander-body">
          {/* 重いマント。肩から足首近くまで後ろへ大きく流れ、裾は布の重みで尖って垂れる。裏地がのぞき、縁に灯の色 */}
          <g className="wander-torso" style={{ transformOrigin: "31px 68px" }}>
            <g className="wander-cape" style={{ transformOrigin: "28px 40px" }}>
              <path d="M29.6,40.2 C25,45.6 18.6,55.4 14.2,66.6 C11.4,73.8 9.8,81.4 9.6,89.4 C11.8,87.6 13.2,90.2 15.6,88.6 C17.4,87.4 18.6,90 20.8,88.4 C22.6,87.2 24,89 26,87.4 C26.4,71.6 27.4,55.4 30.4,43 Z" />
              {/* 翻った裾の内側の裏地 */}
              <path d="M9.6,89.4 C11.8,87.6 13.2,90.2 15.6,88.6 C17.4,87.4 18.6,90 20.8,88.4 C19.6,86.2 18.6,84.6 17.4,84.6 C15.4,84.8 13.6,85.2 11.4,84.4 C10.6,86 10,87.6 9.6,89.4 Z" fill={`url(#${liningId})`} />
              <path d="M9.6,89.4 C11.8,87.6 13.2,90.2 15.6,88.6 C17.4,87.4 18.6,90 20.8,88.4 C22.6,87.2 24,89 26,87.4" fill="none" stroke={glow} strokeWidth={0.6} opacity={0.45} />
              <path d="M29.6,40.2 C25,45.6 18.6,55.4 14.2,66.6 C11.4,73.8 9.8,81.4 9.6,89.4" fill="none" stroke={glow} strokeWidth={0.35} opacity={0.24} />
              {/* 布の重い襞 */}
              <path d="M26.4,46.6 C22.6,56 19.4,68 18,85.4 M28.2,50 C25.8,61 24.2,73 23.6,86 M23.8,52.4 C19.6,62 16.2,73 14.4,84" fill="none" stroke={glow} strokeWidth={0.28} opacity={0.11} />
              {/* 高く立てた襟 */}
              <path d="M28.2,40.6 C25.4,38.4 24.6,35 25.4,31.4 C27,33.4 28.6,36 30.2,39.4 Z" />
              <path d="M25.4,31.4 C27,33.4 28.6,36 30.2,39.4" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.35} />
            </g>
          </g>
          <Leg side="back" cx={28.5} lit={0.12} />
          {/* 上体は腰を軸に少し前へ傾き、歩みや呼吸に合わせて揺れる */}
          <g className="wander-torso" style={{ transformOrigin: "31px 68px" }}>
            {/* 長い裾。腰から三枚の布に分かれ、前は腿の中ほどで割れて脚がのぞき、後ろへ行くほど長く垂れる。
                布はそれぞれ違う間合いで歩みに遅れて翻り、裾が波打つ */}
            {SKIRT.map((p, i) => (
              <g key={p.className} className={`wander-skirt ${p.className}`} style={{ transformOrigin: "31px 55px" }}>
                <g clipPath={`url(#${clipId}-u${i})`}>
                  <path d={p.body} fill="#090b16" />
                  <path d={p.fold} fill="none" stroke={glow} strokeWidth={0.26} opacity={0.2} />
                </g>
                <g className={`wander-skirt-hem ${p.className}-hem`} style={{ transformOrigin: `${p.split[0]}px ${p.split[1]}px` }}>
                  <g clipPath={`url(#${clipId}-l${i})`}>
                    <path d={p.body} fill="#090b16" />
                    <path d={p.fold} fill="none" stroke={glow} strokeWidth={0.26} opacity={0.2} />
                    <path d={p.hem} fill="none" stroke={glow} strokeWidth={0.45} opacity={p.lit} />
                  </g>
                </g>
              </g>
            ))}
            {/* 背中へ流れる長い髪。頭に付いた髪から腰まで何本もの房が垂れ、房ごとに付け根から毛先へ遅れて揺れる */}
            <path d="M31,30.4 C27,30.6 24.6,33 24,37 C23.7,39.4 23.9,41.4 24.3,43.2 L29.2,43.2 C29.2,40 30.4,37.2 32,35.6 Z" />
            {STRANDS.map((h, i) => (
              <g key={i} className="wander-strand" style={{ transformOrigin: `${h.root[0]}px ${h.root[1]}px`, animationDelay: `${h.delay}s` }}>
                <path d={h.upper} />
                <g className="wander-strand-tip" style={{ transformOrigin: `${h.mid[0]}px ${h.mid[1]}px`, animationDelay: `${h.delay - 0.15}s` }}>
                  <path d={h.lower} />
                  {h.sheen && <path d={h.sheen} fill="none" stroke={glow} strokeWidth={0.26} opacity={0.3} />}
                </g>
              </g>
            ))}
            {/* 細い首から胸・コルセットで締めた細い腰・腰の張りへ続く上体 */}
            <path d="M30.6,37.4 C30.6,39 30.3,40 29.7,40.8 C28.6,41.6 27.9,42.8 27.9,44.4 C27.9,46.8 28.9,48.8 29.3,51 C29.5,52.8 28.5,54.6 27.6,56.8 C27,58.6 27,61 27.6,63 L35.4,63 C36,61 36.1,59 35.7,57.2 C35.1,55.2 34.3,53.6 34.1,52 C33.9,50.2 34.5,48.6 35.5,47.6 C36.7,46.5 36.9,44.6 35.9,43.5 C35.2,42.7 34.4,42.1 33.9,41.1 C33.5,40.3 33.4,39.5 33.6,38.6 Z" />
            {/* 灯を受ける胸から腰の前の縁 */}
            <path d="M33.9,41.2 C34.4,42.1 35.2,42.7 35.9,43.5 C36.9,44.6 36.7,46.5 35.5,47.6 C34.5,48.6 33.9,50.2 34.1,52 C34.3,53.6 35.1,55.2 35.7,57.2" fill="none" stroke={glow} strokeWidth={0.32} opacity={0.42} />
            {/* 腰を締めるコルセットの帯と留め金 */}
            <path d="M29.1,49.6 C30.8,50 32.4,50 34.2,49.4 L34.2,54 C32.6,54.6 30.6,54.6 28.9,54.2 Z" fill="#0b0c18" />
            <path d="M29.1,49.6 C30.8,50 32.4,50 34.2,49.4 M28.9,54.2 C30.6,54.6 32.6,54.6 34.2,54" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.55} />
            <path d="M31.3,50.4 L32.3,51.1 L32.3,52.9 L31.3,53.6 L30.3,52.9 L30.3,51.1 Z" fill="#0b0c18" stroke={glow} strokeWidth={0.3} strokeOpacity={0.75} />
            <circle cx={31.3} cy={52} r={0.4} fill={glow} />
            {/* 横顔: 額は帽子のつばの陰、通った鼻筋・唇・小さく尖った顎。顎は少し上げる */}
            <path d="M27.2,33.8 C27.2,31.4 29,30.2 31.4,30.2 C33.4,30.2 34.8,31.2 35.3,32.8 L35.6,34.2 L36.7,35.6 L35.9,35.95 C36.15,36.25 36.1,36.5 35.85,36.65 C36.1,36.9 36.05,37.2 35.75,37.4 C35.8,37.9 35.5,38.35 35,38.6 C34.4,38.9 33.8,38.9 33.3,38.8 L31,38.4 C28.6,37.8 27.2,36.2 27.2,33.8 Z" />
            {/* 灯に照らされた鼻筋と唇の縁 */}
            <path d="M35.6,34.2 L36.7,35.6 L35.9,35.95 C36.15,36.25 36.1,36.5 35.85,36.65 C36.1,36.9 36.05,37.2 35.75,37.4 C35.8,37.9 35.5,38.35 35,38.6" fill="none" stroke={glow} strokeWidth={0.22} opacity={0.5} />
            {/* 揺れる雫の耳飾り */}
            <path d="M31.2,36.4 L31.2,38.2" fill="none" stroke={glow} strokeWidth={0.18} opacity={0.6} />
            <path d="M31.2,38.1 C31.6,38.7 31.6,39.3 31.2,39.5 C30.8,39.3 30.8,38.7 31.2,38.1 Z" fill={glow} opacity={0.85} />
            {/* 顔の前に垂れる一房 */}
            <path className="wander-hair" style={{ transformOrigin: "33px 32px" }} d="M32.2,31.6 C33.8,32.8 34.5,34.6 34.2,36.8 C34.1,37.8 33.8,38.6 33.4,39.2 C33.2,37.6 32.7,36.2 31.8,35 Z" />
            {/* 肩を覆う金具の肩当て。縁が灯を受けて光る */}
            <path d="M29.8,42.2 C31.4,40.8 34,41 35,43 C34.4,43.8 33.6,43.9 32.8,44 C31.8,44.2 31,44.8 30.3,45.6 C29.7,44.6 29.5,43.2 29.8,42.2 Z" fill="#0b0c18" />
            <path d="M29.8,42.2 C31.4,40.8 34,41 35,43 M30.3,45.6 C31,44.8 31.8,44.2 32.8,44 C33.6,43.9 34.4,43.8 35,43" fill="none" stroke={glow} strokeWidth={0.32} opacity={0.6} />
            {/* マントを留める首元のブローチ */}
            <circle cx={30.4} cy={41.2} r={0.95} fill="#0b0c18" stroke={glow} strokeWidth={0.35} strokeOpacity={0.7} />
            <circle cx={30.4} cy={41.2} r={0.42} fill={glow} opacity={0.9} />
            {/* 腰に鎖で提げた魔導書。表紙に星の紋と留め金、縁は杖の灯の色で淡く光り、歩みに遅れて揺れる */}
            <g className="wander-tome" style={{ transformOrigin: "28.4px 53.6px" }}>
              <path d="M28.4,53.6 L26.8,57.2" fill="none" stroke={glow} strokeWidth={0.5} strokeDasharray="0.7 0.45" opacity={0.6} />
              <g transform="rotate(8 26.6 61)">
                <rect x={23.4} y={57} width={6.4} height={7.6} rx={0.6} fill="#0b0c18" stroke={glow} strokeWidth={0.42} strokeOpacity={0.55} />
                <rect x={23.4} y={57} width={1.2} height={7.6} rx={0.4} fill="#06070f" stroke={glow} strokeWidth={0.32} strokeOpacity={0.4} />
                <path d="M27.1,59.1 L27.5,60.4 L28.8,60.8 L27.5,61.2 L27.1,62.5 L26.7,61.2 L25.4,60.8 L26.7,60.4 Z" fill={glow} opacity={0.85} />
                <rect x={29.3} y={60.1} width={1} height={1.3} rx={0.2} fill={glow} opacity={0.6} />
              </g>
            </g>
            {/* 大きな魔法帽。広いつばは縁が反って波打ち、太い帯に縁取りと留め金・宝石、高い円錐は後ろへ折れ、先には星の飾りを提げる */}
            <g className="wander-hat" style={{ transformOrigin: "30px 31px" }}>
              <g transform="rotate(-6 30 31)">
                <path d="M10.6,30.6 C15.4,29.2 22.4,28.4 30,28.6 C37.6,28.4 44.8,29.2 49.4,30.2 C48.4,31.2 47,31.6 45.6,32 C37.6,34.2 22.6,34.4 14.6,32.4 C13,32 11.6,31.4 10.6,30.6 Z" />
                <path d="M10.6,30.6 C11.6,31.4 13,32 14.6,32.4 C22.6,34.4 37.6,34.2 45.6,32 C47,31.6 48.4,31.2 49.4,30.2" fill="none" stroke={glow} strokeWidth={0.35} opacity={0.34} />
                <path d="M21,30 C23.6,22.4 25.4,15.6 27,11.2 C25,8.2 20,6.4 14.4,7 C20.8,3.2 27.4,4.4 31,10.4 C34.8,16.8 36.6,23.8 39.2,30 Z" />
                {/* 灯を受ける円錐の前の縁と折り目 */}
                <path d="M31,10.4 C34.8,16.8 36.6,23.8 39.2,30" fill="none" stroke={glow} strokeWidth={0.28} opacity={0.3} />
                <path d="M27.4,11.6 C29.4,16.6 30.6,21.8 31.4,26.4 M24.8,19.4 C26.8,20.4 29.2,20.6 31.6,19.8" fill="none" stroke={glow} strokeWidth={0.28} opacity={0.14} />
                {/* 太い帯（上下の縁取り）と留め金、宝石 */}
                <path d="M22,27.2 Q30,24.2 38.2,27.2 L38.9,29 Q30,26 21.3,29 Z" fill="#0b0c18" />
                <path d="M22,27.2 Q30,24.2 38.2,27.2 M21.3,29 Q30,26 38.9,29" fill="none" stroke={glow} strokeWidth={0.42} opacity={0.6} />
                <rect x={32.4} y={25.4} width={2.6} height={2.6} rx={0.3} fill="#0b0c18" stroke={glow} strokeWidth={0.4} strokeOpacity={0.75} />
                <circle cx={33.7} cy={26.7} r={0.55} fill={glow} />
                {/* 先に提げた星の飾り */}
                <path d="M14.6,7.3 L14,10.8" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.5} />
                <path d="M13.9,10.8 L14.25,11.85 L15.3,12.2 L14.25,12.55 L13.9,13.6 L13.55,12.55 L12.5,12.2 L13.55,11.85 Z" fill={glow} opacity={0.85} />
              </g>
            </g>
            {/* 杖を握る腕と、杖 */}
            <g className="wander-staff" style={{ transformOrigin: "34px 42px" }}>
              {/* 細い腕: 肩から肘、手首へ締まり、杖を握る */}
              <path d="M31.2,42.6 C33,41.6 34.6,42.6 34.6,44.6 L35.4,48.6 C36.6,50.4 39.4,52.6 42.2,53.6 L41.8,55.6 C38.8,55 35.8,53.6 33.8,51.4 C32.8,50.2 32.2,48.6 31.8,47 C31.4,45.4 30.8,43.8 31.2,42.6 Z" />
              <ellipse cx={42.5} cy={54.7} rx={1.15} ry={1.3} />
              <path d="M34.6,44.6 L35.4,48.6 C36.6,50.4 39.4,52.6 42.2,53.6" fill="none" stroke={glow} strokeWidth={0.26} opacity={0.42} />
              {/* 肘から垂れる、内が割れた長い袖 */}
              <path d="M32.6,48.4 C31.6,52.4 31.8,57 33,61 C33.8,59.6 34.6,59.2 35,57.8 C35.8,58.8 36.8,59 37.4,60 C37.8,57.4 37.6,54.6 36.8,52.4 L35.4,48.8 Z" />
              <path d="M33,61 C33.8,59.6 34.6,59.2 35,57.8 C35.8,58.8 36.8,59 37.4,60" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.4} />
              {/* 杖の柄。握りに革を巻き、石突きは細く尖る */}
              <path d="M45.3,26.4 L38.9,96.6" fill="none" stroke="#04050b" strokeWidth={1.25} strokeLinecap="round" />
              <path d="M45.3,26.4 L38.9,96.6" fill="none" stroke={glow} strokeWidth={0.2} opacity={0.22} transform="translate(0.45 0)" />
              <path d="M43.1,50.6 L42.1,51.2 M42.9,52.4 L41.9,53 M42.3,57 L41.3,57.6 M42.1,58.8 L41.1,59.4" fill="none" stroke={glow} strokeWidth={0.22} opacity={0.35} />
              {/* 杖頭: 二本の爪が三日月のように反って灯の玉を抱き、上に細い穂先、根元に輪 */}
              <path d="M45.3,26.6 C41.4,25.4 40.4,20.4 42.2,17.2 C42.6,16.4 42.8,15.6 42.6,14.8" fill="none" stroke="#04050b" strokeWidth={1.05} strokeLinecap="round" />
              <path d="M45.3,26.6 C49.4,25.2 50.4,20 48.4,17 C48,16.2 47.9,15.4 48.2,14.6" fill="none" stroke="#04050b" strokeWidth={1.05} strokeLinecap="round" />
              <path d="M45.3,26.6 C49.4,25.2 50.4,20 48.4,17" fill="none" stroke={glow} strokeWidth={0.24} opacity={0.5} transform="translate(0.35 0)" />
              <path d="M44.9,17.6 L45.4,13.2 L45.9,17.6 Z" />
              <ellipse cx={45.3} cy={27} rx={1.2} ry={0.55} fill="#0b0c18" stroke={glow} strokeWidth={0.28} strokeOpacity={0.6} />
              <circle className="wander-orb" cx={45.4} cy={21.6} r={8} fill={`url(#${orbId})`} />
              <circle cx={45.4} cy={21.6} r={1.9} fill={glow} />
            </g>
          </g>
          <Leg side="front" cx={33.5} lit={0.3} />
        </g>
      </svg>
      {/* 杖先から零れ、後ろへ流れていく光 */}
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="wander-spark absolute size-[3px] rounded-full"
          style={{ left: "75%", top: "21%", background: glow, boxShadow: `0 0 4px ${glow}`, animationDelay: `${s.delay}s`, "--drift": s.drift } as CSSProperties}
        />
      ))}
    </div>
  );
}
