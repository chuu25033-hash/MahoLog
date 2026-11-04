import { useId, type CSSProperties } from "react";

const SPARKS = Array.from({ length: 6 }, (_, i) => ({ delay: -i * 0.37, drift: 0.6 + ((i * 37) % 10) / 20 }));

/**
 * 腿・脛・足に分けた脚。腿は腰（cx, 66）、脛は膝（cx, 80）、足は足首（cx, 94.5）で曲がる。
 * 脚はふくらみを付けずにまっすぐ細く落とし、膝下までのロングブーツ（履き口に折り返し）を履く
 */
function Leg({ side, cx }: { side: "front" | "back"; cx: number }) {
  const at = (dx: number, y: number) => `${+(cx + dx).toFixed(2)},${y}`;
  return (
    <g className={`wander-thigh wander-${side}`} style={{ transformOrigin: `${cx}px 66px` }}>
      <path d={`M${at(-1.7, 64)} L${at(-1.3, 80)} L${at(1.3, 80)} L${at(1.7, 64)} Z`} />
      <g className={`wander-shin wander-${side}`} style={{ transformOrigin: `${cx}px 80px` }}>
        <circle cx={cx} cy={80} r={1.3} />
        {/* 膝下はブーツの筒。履き口を少し広げて折り返す */}
        <path d={`M${at(-1.3, 80)} L${at(-1.3, 82.6)} L${at(-1.8, 82.8)} L${at(-1.6, 84.4)} L${at(-1.25, 94.6)} L${at(1.25, 94.6)} L${at(1.5, 84.4)} L${at(1.75, 82.8)} L${at(1.3, 82.6)} L${at(1.3, 80)} Z`} />
        <g className={`wander-foot wander-${side}`} style={{ transformOrigin: `${cx}px 94.5px` }}>
          <path d={`M${at(-1.35, 90.8)} L${at(1.35, 90.8)} L${at(1.5, 92.8)} C${at(3.3, 93.2)} ${at(5.6, 94)} ${at(6, 95.6)} L${at(6, 96.6)} L${at(-1.9, 96.6)} C${at(-2.1, 95.2)} ${at(-1.9, 93.6)} ${at(-1.6, 92.6)} Z`} />
        </g>
      </g>
    </g>
  );
}

/**
 * 大きな魔法帽を被り、杖を携えた少女の影絵。右を向いて歩む。
 * 歩みは舞台の [data-walking] で動き（脚の振り・体の上下・外套の揺れ・杖先から零れる光）、
 * 歩みを止めると脚を揃えて立ち止まる。glow は杖先の灯と帽子の飾り紐の色
 */
export function Wanderer({ glow, className, style }: { glow: string; className?: string; style?: CSSProperties }) {
  const orbId = useId();
  return (
    <div className={className} style={{ ...style, "--wander-glow": glow } as CSSProperties} aria-hidden>
      <svg viewBox="0 0 60 100" className="h-full w-full overflow-visible" fill="#04050b">
        <defs>
          <radialGradient id={orbId}>
            <stop offset="0" stopColor={glow} stopOpacity="0.9" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* 足元に落ちる影 */}
        <ellipse cx={31} cy={96.8} rx={12} ry={1.2} fill="#000" opacity={0.45} />
        <g className="wander-body">
          <Leg side="back" cx={28.5} />
          {/* 上体は腰を軸に少し前へ傾き、歩みや呼吸に合わせて揺れる */}
          <g className="wander-torso" style={{ transformOrigin: "31px 68px" }}>
            {/* 外套（後ろへたなびく） */}
            <path className="wander-cape" style={{ transformOrigin: "27px 40px" }} d="M27,40 C21,48 15.5,58 12.5,69 C16,67.5 19,68.6 21.5,67.4 L27.5,45 Z" />
            {/* 衣 */}
            <path d="M27,39 C30,37.8 33,38 35,39.6 L42.6,72.4 C34,75.6 25.4,75.8 18.4,72.6 Z" />
            {/* 後ろへ流れる髪と頭 */}
            <path className="wander-hair" style={{ transformOrigin: "28px 34px" }} d="M26,32 C21.5,36 20.5,42 21.5,48 C23.4,46 24.6,45 26,45.6 C26.8,41 28,37 30.5,35 Z" />
            <circle cx={31} cy={35} r={5} />
            {/* 大きな魔法帽。歩みや風に少し遅れて揺れる */}
            <g className="wander-hat" style={{ transformOrigin: "30px 31px" }}>
              <g transform="rotate(-5 30 31)">
                <ellipse cx={30} cy={31} rx={19.5} ry={3.2} />
                <path d="M20,30 C23,22 25,16 27,12 C25,9 20,7 15,7.5 C21,4 27,5 31,11 C35,17 37,24 40,30 Z" />
                <path d="M21.2,28.4 Q30,25.2 38.8,28.4" fill="none" stroke={glow} strokeWidth={0.9} opacity={0.55} />
              </g>
            </g>
            {/* 杖を握る腕と、杖 */}
            <g className="wander-staff" style={{ transformOrigin: "34px 42px" }}>
              <path d="M34,42 L42.6,54.6" fill="none" stroke="#04050b" strokeWidth={3} strokeLinecap="round" />
              <path d="M45.2,25 L38.8,97" fill="none" stroke="#04050b" strokeWidth={1.6} strokeLinecap="round" />
              <path d="M45.2,25.6 C49.6,23.8 49.4,18.4 45.6,17.6" fill="none" stroke="#04050b" strokeWidth={1.3} strokeLinecap="round" />
              <circle className="wander-orb" cx={45.4} cy={21.6} r={8} fill={`url(#${orbId})`} />
              <circle cx={45.4} cy={21.6} r={2} fill={glow} />
            </g>
          </g>
          <Leg side="front" cx={33.5} />
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
