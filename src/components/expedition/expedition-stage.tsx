import { memo, type CSSProperties } from "react";
import { EXPEDITION_FLOOR, type ExpeditionLayer, type ExpeditionScene } from "@/lib/expedition";
import { cn } from "@/lib/utils";
import { BackdropTile, FLOOR_SURFACE, sourceAspect } from "./backdrop-art";
import { Wanderer } from "./wanderer";
import "./expedition.css";

/** 少女の歩む速さ（舞台の高さ / 秒）。足元の床がこの速さで流れる。地面に着いた足の送り（expedition.css の歩みのキーフレーム）と同じ速さにし、足が床を滑らないようにする */
const WALK_SPEED = 0.0335;
/** 層を敷き詰めるときに見込む、舞台の横長さ（幅 ÷ 高さ）の上限 */
const MAX_STAGE_ASPECT = 3;
/** 少女の背丈（舞台の高さに対する割合） */
const WANDERER_HEIGHT = 0.26;
/** 少女の絵の下端から足裏までの割合（wanderer.tsx の viewBox は高さ 100、足裏は 96.6） */
const SOLE_INSET = (100 - 96.6) / 100;
/** 足裏が床の地面の線にちょうど着く位置 */
const WANDERER_BOTTOM = EXPEDITION_FLOOR * (1 - FLOOR_SURFACE) - WANDERER_HEIGHT * SOLE_INSET;

const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 7.3 + ((i * 53) % 11)) % 100,
  top: 8 + ((i * 37) % 70),
  size: 1.5 + ((i * 17) % 10) / 6,
  duration: 7 + ((i * 29) % 9),
  delay: -((i * 1.9) % 12),
}));

/**
 * 層の絵を横に並べ、1枚分の幅だけ左へ流してから戻すのを繰り返す（継ぎ目なく流れ続けて見える）。
 * transform だけを動かすので、描き直しは起きない
 */
function ParallaxLayer({ layer }: { layer: ExpeditionLayer }) {
  const tileWidth = sourceAspect(layer.source) * layer.height; // 舞台の高さを 1 とした1枚の幅
  const copies = Math.ceil(MAX_STAGE_ASPECT / tileWidth) + 1;
  return (
    <div
      className="absolute inset-x-0"
      style={{ bottom: `${layer.bottom * 100}%`, height: `${layer.height * 100}%`, color: layer.color, opacity: layer.opacity ?? 1 }}
    >
      <div
        className="expedition-strip flex h-full w-max"
        style={{ "--copies": copies, animationDuration: `${(tileWidth / (WALK_SPEED * layer.speed)).toFixed(2)}s` } as CSSProperties}
      >
        {Array.from({ length: copies }, (_, i) => (
          <BackdropTile key={i} source={layer.source} accent={layer.accent ?? layer.color} />
        ))}
      </div>
    </div>
  );
}

/**
 * 探索の景色。scene の層を奥から重ね、魔法使いの少女が右へ歩む。
 * walking のあいだだけ景色が流れて少女が歩き、止めるとその場で立ち止まる（景色は止めた位置のまま）。
 * 詠唱の画面は時計のために頻繁に描き直されるので、props が変わらない限り描き直さない
 */
export const ExpeditionStage = memo(function ExpeditionStage({
  scene,
  walking,
  glow,
  className,
}: {
  scene: ExpeditionScene;
  walking: boolean;
  /** 杖先の灯の色（詠唱する属性の色） */
  glow: string;
  className?: string;
}) {
  const [top, middle, horizon] = scene.sky;
  return (
    <div
      className={cn("expedition overflow-hidden", className)}
      data-walking={walking || undefined}
      style={{ containerType: "size", background: `linear-gradient(to bottom, ${top}, ${middle} 55%, ${horizon})` }}
      aria-hidden
    >
      {/* 地平に滲む光 */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/4"
        style={{ background: `radial-gradient(ellipse 70% 55% at 50% 100%, ${scene.glow}38, transparent 70%)` }}
      />
      {scene.layers.map((layer, i) => (
        <ParallaxLayer key={i} layer={layer} />
      ))}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className={`expedition-mote expedition-mote-${scene.motes.kind} absolute rounded-full`}
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: scene.motes.color,
            boxShadow: `0 0 ${m.size * 3}px ${scene.motes.color}`,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
      <Wanderer
        glow={glow}
        className="wanderer absolute aspect-[3/5]"
        style={{ left: "22%", height: `${WANDERER_HEIGHT * 100}%`, bottom: `${WANDERER_BOTTOM * 100}%` }}
      />
      {/* 四隅を沈め、重ねる時計や札を読みやすくする */}
      <div className="absolute inset-0 shadow-[inset_0_0_80px_20px_rgba(3,4,10,0.75)]" />
    </div>
  );
});
