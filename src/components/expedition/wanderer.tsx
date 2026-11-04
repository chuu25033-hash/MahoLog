import { useId, type CSSProperties } from "react";

const SPARKS = Array.from({ length: 6 }, (_, i) => ({ delay: -i * 0.37, drift: 0.6 + ((i * 37) % 10) / 20 }));

/**
 * 腿・脛・足に分けた脚。腿は腰（cx, 66）、脛は膝（cx, 80）、足は足首（cx, 94.5）で曲がる。
 * 脚はふくらみを付けずにまっすぐ細く落とし、膝までのロングブーツ（履き口は膝の高さで広がり、つま先は細く、低い踵）を履く
 */
function Leg({ side, cx }: { side: "front" | "back"; cx: number }) {
  const at = (dx: number, y: number) => `${+(cx + dx).toFixed(2)},${y}`;
  return (
    <g className={`wander-thigh wander-${side}`} style={{ transformOrigin: `${cx}px 66px` }}>
      <path d={`M${at(-1.7, 64)} L${at(-1.3, 80)} L${at(1.3, 80)} L${at(1.7, 64)} Z`} />
      <g className={`wander-shin wander-${side}`} style={{ transformOrigin: `${cx}px 80px` }}>
        <circle cx={cx} cy={80} r={1.3} />
        {/* ブーツの筒。履き口は膝の高さで外へ広がり、筒は脚より一回り太く足首まで下りる */}
        <path d={`M${at(-2.1, 79.2)} L${at(2.15, 79.2)} L${at(1.95, 81.6)} L${at(1.6, 82.1)} L${at(1.35, 94.6)} L${at(-1.35, 94.6)} L${at(-1.65, 82.1)} L${at(-1.95, 81.6)} Z`} />
        <g className={`wander-foot wander-${side}`} style={{ transformOrigin: `${cx}px 94.5px` }}>
          {/* ブーツの足先: 甲はなだらかに下り、つま先は細く尖る。低い踵（ヒール）を付け、土踏まずの下を浮かせる */}
          <path
            d={`M${at(-1.25, 90.8)} L${at(1.25, 90.8)} L${at(1.35, 93)} C${at(2.6, 93.4)} ${at(4.6, 94.6)} ${at(6.3, 95.9)} C${at(6.6, 96.2)} ${at(6.2, 96.6)} ${at(5.6, 96.6)} L${at(1, 96.6)} C${at(0.4, 96.6)} ${at(0.1, 95.9)} ${at(-0.4, 95.9)} L${at(-0.6, 96.6)} L${at(-1.9, 96.6)} L${at(-1.8, 94.2)} C${at(-1.7, 93)} ${at(-1.5, 91.8)} ${at(-1.25, 90.8)} Z`}
          />
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
          {/* 重いマント。肩から足首近くまで垂れ、裾と縁に灯の色の縁取り、立てた襟。布が重いので揺れは小さくゆっくり */}
          <g className="wander-torso" style={{ transformOrigin: "31px 68px" }}>
            <g className="wander-cape" style={{ transformOrigin: "27.5px 40px" }}>
              <path d="M28.4,38.6 C24.6,45.6 19.8,55.6 16.6,67.4 C15,73.6 14.2,80.2 14.6,87 C17.4,85.6 19.4,86.8 21.8,86.2 C23.6,85.8 25.4,86.4 27,85.6 C26.8,72 27.4,56 29.4,43.4 Z" />
              <path d="M14.6,87 C17.4,85.6 19.4,86.8 21.8,86.2 C23.6,85.8 25.4,86.4 27,85.6" fill="none" stroke={glow} strokeWidth={0.7} opacity={0.5} />
              <path d="M28.4,38.6 C24.6,45.6 19.8,55.6 16.6,67.4 C15,73.6 14.2,80.2 14.6,87" fill="none" stroke={glow} strokeWidth={0.4} opacity={0.28} />
              {/* 布の重い襞 */}
              <path d="M25.4,46 C22.4,56 20.4,68 20,85.6 M27.6,50 C25.8,62 24.8,74 24.6,85.8" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.12} />
              {/* 立てた襟 */}
              <path d="M27.2,39.4 C24.8,37.2 24.4,34.4 25.4,31.6 C26.6,33.4 27.8,35.6 29.2,38.4 Z" />
            </g>
          </g>
          <Leg side="back" cx={28.5} />
          {/* 上体は腰を軸に少し前へ傾き、歩みや呼吸に合わせて揺れる */}
          <g className="wander-torso" style={{ transformOrigin: "31px 68px" }}>
            {/* 魔導士のローブ。前は膝丈、後ろへ行くほど長い燕尾になり、裾は不揃いに尖る */}
            <path d="M27,39 C30,37.8 33,38 35,39.6 L42.6,70.4 C41.3,72.5 39.5,73.6 37.6,73.8 L34.8,76.4 L32.4,74.8 L29.2,79.8 L26.8,76.9 L23,84 L21.6,78 L17,81.4 C17.6,70 21.6,52.5 27,39 Z" />
            {/* 背中へ流れる長い髪。毛先は分かれ、淡い艶の筋で影絵の中でも髪と分かるようにする */}
            <g className="wander-hair" style={{ transformOrigin: "29px 33px" }}>
              <path d="M30.6,30.4 C26.4,31 23.6,34.4 22.8,39.6 C22,45 21.8,51 20.4,56.6 C19.8,59.2 18.8,61.4 17.6,63.2 C19.6,62.6 21,61.6 22,60.2 C22.2,61.8 21.8,63.4 21.2,64.8 C23,64 24.2,62.6 24.8,61 C25.4,62.2 25.8,63.4 25.8,64.6 C27,63 27.4,61 27.2,58.8 C27,53.6 27.4,47.6 28.6,42.8 C29.4,39.6 30.6,37 32.2,35.2 Z" />
              <path d="M27,33.4 C24.8,37.8 24,44 23.4,50.4 C23,54.6 22,58.4 20.4,61.4 M28.8,35 C27,40 26,46.8 25.6,53.8 C25.4,57.4 25,60.4 24,62.4" fill="none" stroke={glow} strokeWidth={0.32} opacity={0.2} />
            </g>
            {/* 横顔（額は帽子のつばの陰、鼻先・口元・あご） */}
            <path d="M26.8,34 C26.8,31.4 28.8,30 31.2,30 C33.6,30 35.4,31.4 35.8,33.4 L36.7,35.5 L35.9,35.9 C36,36.5 35.8,37 35.4,37.5 C34.8,38.4 33.8,38.9 32.8,38.9 L29.8,38.9 C28,38.4 26.8,36.4 26.8,34 Z" />
            {/* 顔の前に垂れる一房 */}
            <path className="wander-hair" style={{ transformOrigin: "33px 32px" }} d="M32.2,31.6 C33.8,32.8 34.6,34.6 34.4,36.8 C34.3,37.8 34,38.6 33.6,39.2 C33.4,37.6 32.8,36.2 31.8,35 Z" />
            {/* マントを留める首元のブローチ */}
            <circle cx={31.6} cy={41.4} r={1.1} fill="#0b0c18" stroke={glow} strokeWidth={0.4} strokeOpacity={0.7} />
            <circle cx={31.6} cy={41.4} r={0.48} fill={glow} opacity={0.9} />
            {/* 腰に鎖で提げた魔導書。表紙に星の紋と留め金、縁は杖の灯の色で淡く光り、歩みに遅れて揺れる */}
            <g className="wander-tome" style={{ transformOrigin: "27.6px 52.6px" }}>
              <path d="M27.6,52.6 L27,56.3" fill="none" stroke={glow} strokeWidth={0.55} strokeDasharray="0.7 0.45" opacity={0.6} />
              <rect x={23.2} y={56.1} width={7} height={8} rx={0.6} fill="#0b0c18" stroke={glow} strokeWidth={0.45} strokeOpacity={0.55} />
              <rect x={23.2} y={56.1} width={1.3} height={8} rx={0.4} fill="#06070f" stroke={glow} strokeWidth={0.35} strokeOpacity={0.4} />
              <path d="M27.2,58.3 L27.6,59.7 L29,60.1 L27.6,60.5 L27.2,61.9 L26.8,60.5 L25.4,60.1 L26.8,59.7 Z" fill={glow} opacity={0.85} />
              <rect x={29.7} y={59.4} width={1.1} height={1.4} rx={0.2} fill={glow} opacity={0.6} />
            </g>
            {/* 大きな魔法帽。広いつばは縁が反り、太い帯に縁取りと留め金・宝石、円錐には折り目、先には星の飾りを提げる */}
            <g className="wander-hat" style={{ transformOrigin: "30px 31px" }}>
              <g transform="rotate(-5 30 31)">
                <path d="M8.6,30.6 C13.6,29.2 21.6,28.4 30,28.6 C38.4,28.4 46.4,29.2 51.4,30.4 C50.2,31.4 48.8,31.8 47.4,32.2 C38,34.6 22,34.8 12.6,32.4 C11,32 9.6,31.4 8.6,30.6 Z" />
                <path d="M8.6,30.6 C9.6,31.4 11,32 12.6,32.4 C22,34.8 38,34.6 47.4,32.2 C48.8,31.8 50.2,31.4 51.4,30.4" fill="none" stroke={glow} strokeWidth={0.35} opacity={0.3} />
                <path d="M20,30 C23,22 25,16 27,12 C25,9 20,7 15,7.5 C21,4 27,5 31,11 C35,17 37,24 40,30 Z" />
                {/* 円錐の折り目 */}
                <path d="M27.4,12.4 C29.4,17 30.6,22 31.4,26.4 M24.6,19.6 C26.6,20.6 29,20.8 31.4,20" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.14} />
                {/* 太い帯（上下の縁取り）と留め金、宝石 */}
                <path d="M21.3,27.2 Q30,24 38.7,27.2 L39.4,29 Q30,25.9 20.6,29 Z" fill="#0b0c18" />
                <path d="M21.3,27.2 Q30,24 38.7,27.2 M20.6,29 Q30,25.9 39.4,29" fill="none" stroke={glow} strokeWidth={0.45} opacity={0.6} />
                <rect x={32.6} y={25.4} width={2.6} height={2.6} rx={0.3} fill="#0b0c18" stroke={glow} strokeWidth={0.4} strokeOpacity={0.75} />
                <circle cx={33.9} cy={26.7} r={0.55} fill={glow} />
                {/* 先に提げた星の飾り */}
                <path d="M15.2,7.8 L14.6,11.2" fill="none" stroke={glow} strokeWidth={0.3} opacity={0.5} />
                <path d="M14.5,11.2 L14.85,12.25 L15.9,12.6 L14.85,12.95 L14.5,14 L14.15,12.95 L13.1,12.6 L14.15,12.25 Z" fill={glow} opacity={0.85} />
              </g>
            </g>
            {/* 杖を握る腕と、杖 */}
            <g className="wander-staff" style={{ transformOrigin: "34px 42px" }}>
              <path d="M34,42 L42.6,54.6" fill="none" stroke="#04050b" strokeWidth={3} strokeLinecap="round" />
              {/* 手首で広がる魔導士の袖 */}
              <path d="M33.2,41.2 L40.6,51.6 C41.6,53.6 41.6,56.4 40.4,59 C38.6,57.2 36.6,55.6 34.8,53.6 L32.4,46 Z" />
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
