"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { EXPEDITION_FLOOR, isHaze, type ExpeditionHaze, type ExpeditionLayer, type ExpeditionScene } from "@/lib/expedition";
import { cn } from "@/lib/utils";
import { BackdropTile, FLOOR_SURFACE, sourceAspect } from "./backdrop-art";
import { SkyObject } from "./sky-objects";
import { Wanderer } from "./wanderer";
import "./expedition.css";

/** 少女の歩む速さ（舞台の高さ / 秒）。足元の床がこの速さで流れる。地面に着いた足の送り（expedition.css の歩みのキーフレーム）と同じ速さにし、足が床を滑らないようにする */
const WALK_SPEED = 0.0387;
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
          <BackdropTile key={i} source={layer.source} accent={layer.accent ?? layer.color} rim={layer.rim} />
        ))}
      </div>
    </div>
  );
}

/** 歩みに合わせて動く CSS アニメーション（歩き出し・立ち止まりで、まとめて速さを変える） */
const WALK_ANIMATIONS = new Set([
  "expedition-scroll",
  "wander-thigh",
  "wander-shin",
  "wander-foot",
  "wander-bob",
  "wander-lean",
  "wander-hat",
  "wander-hair",
  "wander-mantle",
  "wander-cape",
  "wander-staff",
]);
/** 姿勢を持つ部位（立ち姿と歩く姿勢の間をなめらかにつなぐ） */
const POSE_PARTS = ".wander-body, .wander-torso, .wander-thigh, .wander-shin, .wander-foot, .wander-hat, .wander-hair, .wander-cape, .wander-staff, .wander-tome";
/** 歩き出しで歩みが速まる時間・立ち止まりで緩む時間（ミリ秒） */
const SPEED_UP_MS = 900;
const SLOW_DOWN_MS = 800;
/** 姿勢を移す時間（ミリ秒） */
const POSE_BLEND_MS = 550;
const MIN_RATE = 0.04;

const easeInOut = (t: number) => t * t * (3 - 2 * t);

/**
 * 歩き出しと立ち止まりをなめらかにする。歩き出しは姿勢を立ち姿から歩く姿勢へ移しつつ、歩みと景色を一緒にゆっくり速め、
 * 立ち止まりは一緒に緩めてから立ち姿へ戻す（歩みと景色の速さはいつも同じ割合なので、足は床を滑らない）。
 * 動きを抑える設定では、切り替えるだけにする
 */
function useWalkTransition(walking: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = 0;
    let cancelled = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const walkAnimations = () =>
      root.getAnimations({ subtree: true }).filter((a): a is CSSAnimation => a instanceof CSSAnimation && WALK_ANIMATIONS.has(a.animationName));
    const setRate = (rate: number) => {
      for (const a of walkAnimations()) a.playbackRate = rate;
    };
    const currentRate = () => walkAnimations()[0]?.playbackRate ?? 1;
    /** 歩みの速さを from から to へ ms かけて移す */
    const ramp = (from: number, to: number, ms: number, done?: () => void) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / ms);
        setRate(from + (to - from) * easeInOut(t));
        if (t < 1) frame = requestAnimationFrame(tick);
        else done?.();
      };
      frame = requestAnimationFrame(tick);
    };
    /** 姿勢の切り替え前の形を覚えておき、切り替え後の動きへなめらかに移す */
    const blendPose = (change: () => void) => {
      const parts = [...root.querySelectorAll(POSE_PARTS)].map((el) => [el, getComputedStyle(el).transform] as const);
      change();
      for (const [el, transform] of parts) el.animate([{ transform }], { duration: POSE_BLEND_MS, easing: "cubic-bezier(0.3, 0.6, 0.3, 1)" });
    };

    const isWalking = root.hasAttribute("data-walking");
    if (walking) {
      if (reduce) {
        root.setAttribute("data-walking", "");
        return;
      }
      let from = currentRate();
      if (!isWalking) {
        blendPose(() => root.setAttribute("data-walking", ""));
        from = MIN_RATE;
        setRate(from);
      }
      ramp(from, 1, SPEED_UP_MS);
    } else if (isWalking) {
      if (reduce) {
        root.removeAttribute("data-walking");
        return;
      }
      ramp(currentRate(), MIN_RATE, SLOW_DOWN_MS, () => {
        blendPose(() => root.removeAttribute("data-walking"));
        setRate(1);
      });
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [walking]);
  return ref;
}

/** 層の間に漂う霞の帯（上下へ淡く溶ける） */
function HazeBand({ haze }: { haze: ExpeditionHaze }) {
  return (
    <div
      className="expedition-haze absolute inset-x-0"
      style={{
        bottom: `${haze.bottom * 100}%`,
        height: `${haze.height * 100}%`,
        opacity: haze.opacity,
        background: `linear-gradient(to top, transparent, ${haze.haze} 45%, ${haze.haze} 55%, transparent)`,
      }}
    />
  );
}

/** 窓や月から斜めに差し込む光の筋。ぼかした帯を並べ、ゆっくり明滅させる */
const RAYS = [
  { at: 0.08, width: 0.09, delay: 0 },
  { at: 0.2, width: 0.05, delay: -3 },
  { at: 0.31, width: 0.12, delay: -6 },
  { at: 0.5, width: 0.06, delay: -2 },
];

function LightRays({ rays }: { rays: NonNullable<ExpeditionScene["rays"]> }) {
  const side = rays.from === "right" ? "right" : "left";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: rays.opacity }}>
      {RAYS.map((r, i) => (
        <div
          key={i}
          className="expedition-ray absolute -top-[10%] h-[95%]"
          style={{
            [side]: `${r.at * 100}%`,
            width: `${r.width * 100}%`,
            transform: `skewX(${side === "right" ? 24 : -24}deg)`,
            transformOrigin: "top",
            background: `linear-gradient(to bottom, ${rays.color}, transparent 85%)`,
            animationDelay: `${r.delay}s`,
          }}
        />
      ))}
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
  // 歩いているかどうか（data-walking）は、歩き出し・立ち止まりをなめらかにするためにここで付け外しする
  const ref = useWalkTransition(walking);
  return (
    <div
      ref={ref}
      className={cn("expedition overflow-hidden", className)}
      style={{
        containerType: "size",
        // 空のグラデーションに、遠くの淡い光の雲を重ねる
        background: `radial-gradient(ellipse 45% 30% at 30% 22%, ${scene.glow}14, transparent 70%), radial-gradient(ellipse 55% 35% at 78% 35%, ${scene.glow}10, transparent 70%), linear-gradient(to bottom, ${top}, ${middle} 55%, ${horizon})`,
      }}
      aria-hidden
    >
      {/* 地平に滲む光 */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/4"
        style={{ background: `radial-gradient(ellipse 70% 55% at 50% 100%, ${scene.glow}38, transparent 70%)` }}
      />
      {/* 空に掛かる、流れない大きな物（月・天文盤・オーロラ・炉心・星冠・銀河・塔） */}
      {scene.celestial?.map((object, i) => <SkyObject key={i} object={object} />)}
      {scene.rays && <LightRays rays={scene.rays} />}
      {scene.layers.map((layer, i) => (isHaze(layer) ? <HazeBand key={i} haze={layer} /> : <ParallaxLayer key={i} layer={layer} />))}
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
