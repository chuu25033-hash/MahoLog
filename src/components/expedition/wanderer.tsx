import { useId, type CSSProperties } from "react";

const SPARKS = Array.from({ length: 6 }, (_, i) => ({ delay: -i * 0.37, drift: 0.6 + ((i * 37) % 10) / 20 }));

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
        <ellipse cx={31} cy={97.5} rx={13} ry={1.6} fill="#000" opacity={0.45} />
        <g className="wander-body">
          {/* 奥の脚 */}
          <g className="wander-leg wander-leg-back" style={{ transformOrigin: "28.5px 66px" }}>
            <rect x={27} y={65} width={3} height={29} rx={1.4} />
            <path d="M26.6,92 H31 C33.2,92 34.4,94 34.4,96.6 H26.6 Z" />
          </g>
          {/* 外套（後ろへたなびく） */}
          <path className="wander-cape" style={{ transformOrigin: "27px 40px" }} d="M27,40 C21,48 15.5,58 12.5,69 C16,67.5 19,68.6 21.5,67.4 L27.5,45 Z" />
          {/* 衣 */}
          <path d="M27,39 C30,37.8 33,38 35,39.6 L41.5,68 C34,71.2 26,71.4 19.5,68.2 Z" />
          {/* 手前の脚 */}
          <g className="wander-leg wander-leg-front" style={{ transformOrigin: "33.5px 66px" }}>
            <rect x={32} y={65} width={3} height={29} rx={1.4} />
            <path d="M31.6,92 H36 C38.2,92 39.4,94 39.4,96.6 H31.6 Z" />
          </g>
          {/* 後ろへ流れる髪と頭 */}
          <path d="M26,32 C21.5,36 20.5,42 21.5,48 C23.4,46 24.6,45 26,45.6 C26.8,41 28,37 30.5,35 Z" />
          <circle cx={31} cy={35} r={5} />
          {/* 大きな魔法帽。先は歩みに遅れて後ろへ折れる */}
          <g transform="rotate(-5 30 31)">
            <ellipse cx={30} cy={31} rx={19.5} ry={3.2} />
            <path d="M20,30 C23,22 25,16 27,12 C25,9 20,7 15,7.5 C21,4 27,5 31,11 C35,17 37,24 40,30 Z" />
            <path d="M21.2,28.4 Q30,25.2 38.8,28.4" fill="none" stroke={glow} strokeWidth={0.9} opacity={0.55} />
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
