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

/** 杖先の灯の位置（舞台の高さを 1 とした、少女の左端からの横の距離と、床からの高さ。wanderer.tsx の viewBox 60×100 の 45.4, 21.6） */
const ORB_X = WANDERER_HEIGHT * 0.6 * (45.4 / 60);
const ORB_Y = WANDERER_BOTTOM + WANDERER_HEIGHT * (1 - 21.6 / 100);

/**
 * 目の前を漂う、ピントの合わない大きな光の粒（被写界深度）。景色の手前にあるように見せ、奥行きを出す。
 * 少女の立つあたりは避けて置く
 */
const BOKEH = [
  { left: 6, top: 18, size: 9, duration: 26, delay: 0, o: 0.16 },
  { left: 48, top: 10, size: 5, duration: 31, delay: -9, o: 0.12 },
  { left: 63, top: 62, size: 12, duration: 34, delay: -17, o: 0.1 },
  { left: 84, top: 30, size: 7, duration: 24, delay: -5, o: 0.14 },
  { left: 92, top: 74, size: 15, duration: 38, delay: -22, o: 0.08 },
  { left: 36, top: 80, size: 6, duration: 29, delay: -13, o: 0.1 },
];

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
  "sky-turn",
  "sky-turn-back",
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
/** 歩みの1周期（ミリ秒。expedition.css の歩みのキーフレームと同じ） */
const GAIT_MS = 1800;
/**
 * 立ち止まる位相: 奥の足が地面に着いて体を支え、手前の足が前へ振り出されているところ。
 * ここから手前の足を前に下ろして立ち姿になる（立ち姿の奥の脚は、この位相の奥の脚と同じ形にしてあるので動かない）
 */
const STOP_PHASE = 0.72;
/** 歩き出す位相: 手前の足に体重を移し、奥の足が地面を離れ始めるところ（立ち姿に近い） */
const START_PHASE = 0.08;
/** 立ち止まる前に緩め始める残り（周期に対する割合。最後の半歩ほど） */
const SLOW_SPAN = 0.45;
/** 歩き出しの最初の速さと、全速になるまでの時間（ミリ秒） */
const START_RATE = 0.2;
const SPEED_UP_MS = 1100;
/** 姿勢を移す時間（ミリ秒） */
const POSE_BLEND_MS = 450;

const easeInOut = (t: number) => t * t * (3 - 2 * t);

/**
 * 歩き出しと立ち止まりを、人の歩みに近づける。
 * 歩き出しは両足で立った姿勢（手前の足が着いた瞬間）から一歩目を踏み出し、ゆっくりから全速へ速める。
 * 立ち止まりは、その場で動きを止めず（片足が宙に浮いたまま固まらないよう）、次に手前の足が着いて両足で立つ瞬間まで歩き、
 * 最後の半歩で緩めてから立ち姿へ移る。歩みと景色の速さはいつも同じ割合なので、足は床を滑らない。
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
    /** いまの歩みの位相（0〜1。手前の脚の腿の動きで測る） */
    const gaitPhase = () => {
      const thigh = root.querySelector(".wander-thigh.wander-front")?.getAnimations().find((a): a is CSSAnimation => a instanceof CSSAnimation);
      const t = Number(thigh?.currentTime ?? 0);
      return (((t % GAIT_MS) + GAIT_MS) % GAIT_MS) / GAIT_MS;
    };
    /** 姿勢の切り替え前の形を覚えておき、切り替え後の動きへなめらかに移す */
    const blendPose = (change: () => void) => {
      const parts = [...root.querySelectorAll(POSE_PARTS)].map((el) => [el, getComputedStyle(el).transform] as const);
      change();
      // 覚えた形を始まり（offset: 0）に置き、終わりは切り替え後のいまの動きに任せる（キーフレームが一つだけだと終わりの形として扱われる）
      for (const [el, transform] of parts) el.animate([{ transform, offset: 0 }], { duration: POSE_BLEND_MS, easing: "cubic-bezier(0.3, 0.6, 0.3, 1)" });
    };

    const isWalking = root.hasAttribute("data-walking");
    if (walking) {
      if (reduce) {
        root.setAttribute("data-walking", "");
        return;
      }
      let from = currentRate();
      if (!isWalking) {
        // 立ち姿に近い位相（手前の足に体重を移したところ）から歩み出す。景色の位置は動かさない
        blendPose(() => root.setAttribute("data-walking", ""));
        for (const a of walkAnimations()) {
          if (a.animationName !== "expedition-scroll") a.currentTime = Number(a.currentTime ?? 0) + START_PHASE * GAIT_MS;
        }
        from = START_RATE;
        setRate(from);
      }
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / SPEED_UP_MS);
        setRate(from + (1 - from) * easeInOut(t));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } else if (isWalking) {
      if (reduce) {
        root.removeAttribute("data-walking");
        return;
      }
      // 次に立ち止まれる位相まで歩く。すぐそこなら、もう一歩歩いてから止まる（全速から急に止まらないように）
      let left = (STOP_PHASE - gaitPhase() + 1) % 1;
      if (left < 0.2) left += 1;
      let last = gaitPhase();
      const top = currentRate();
      const tick = () => {
        if (cancelled) return;
        const phase = gaitPhase();
        left -= (phase - last + 1) % 1;
        last = phase;
        if (left <= 0.004) {
          blendPose(() => root.removeAttribute("data-walking"));
          setRate(1);
          return;
        }
        setRate(Math.max(0.22, top * Math.min(1, 0.22 + (0.78 * left) / SLOW_SPAN)));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [walking]);
  return ref;
}

/** 床に映り込む空の光（磨いた床・硝子の床だけ。草の床には映さない） */
const REFLECTED = new Set(["moon", "crown", "core", "astrolabe", "spire", "aurora"]);
function FloorReflection({ scene }: { scene: ExpeditionScene }) {
  const source = scene.celestial?.find((c) => REFLECTED.has(c.kind));
  const floorLayer = scene.layers[scene.layers.length - 1];
  if (!source || isHaze(floorLayer) || ("art" in floorLayer.source && floorLayer.source.art === "grass")) return null;
  const height = `${EXPEDITION_FLOOR * (1 - FLOOR_SURFACE) * 100}%`;
  const ripple = "repeating-linear-gradient(to bottom, #000 0 2px, rgba(0,0,0,0.45) 2px 5px)";
  if (source.kind === "aurora") {
    // 空いっぱいの光は、床全体にうっすら映る
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height, mixBlendMode: "screen", background: `linear-gradient(to bottom, ${source.color}1c, transparent 80%)`, maskImage: ripple }}
      />
    );
  }
  return (
    <div
      className="expedition-reflection pointer-events-none absolute bottom-0"
      style={{
        left: `${source.x * 100}%`,
        width: `${Math.max(10, source.size * 40)}cqh`,
        height,
        transform: "translateX(-50%)",
        mixBlendMode: "screen",
        background: `radial-gradient(ellipse 50% 100% at 50% 0, ${source.color}55, ${source.color}1a 45%, transparent 75%)`,
        maskImage: ripple,
      }}
    />
  );
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
      <FloorReflection scene={scene} />
      {/* 床の近くを、薄い靄がゆっくり流れる（二枚を違う速さで重ねる） */}
      {[0, 1].map((k) => (
        <div
          key={k}
          className="expedition-mist pointer-events-none absolute inset-x-0"
          style={{
            bottom: `${(EXPEDITION_FLOOR - 0.02 + k * 0.03) * 100}%`,
            height: `${(0.12 + k * 0.06) * 100}%`,
            opacity: k ? 0.07 : 0.1,
            animationDuration: `${k ? 140 : 90}s`,
            backgroundImage: `radial-gradient(ellipse 18% 50% at 20% 60%, ${scene.glow}, transparent 70%), radial-gradient(ellipse 24% 40% at 55% 50%, ${scene.glow}, transparent 70%), radial-gradient(ellipse 16% 45% at 85% 65%, ${scene.glow}, transparent 70%)`,
          }}
        />
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
      {/* 景色全体を沈め、どの舞台も書庫と同じ薄暗さにする（少女はこの上に描くので沈まない） */}
      {scene.dim ? <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(4, 3, 10, ${scene.dim})` }} /> : null}
      {/* 杖先の灯が、まわりの空気と足元の床をほのかに照らす（少女と一緒に動かない位置にあるので、景色が流れても灯はついてくる） */}
      <div
        className="expedition-staff-light pointer-events-none absolute rounded-full"
        style={{
          left: `calc(22% + ${ORB_X * 100}cqh)`,
          bottom: `${ORB_Y * 100}%`,
          width: "70cqh",
          height: "70cqh",
          transform: "translate(-50%, 50%)",
          background: `radial-gradient(circle, ${glow}2e, ${glow}10 35%, transparent 70%)`,
        }}
      />
      <div
        className="expedition-staff-light pointer-events-none absolute rounded-[50%]"
        style={{
          left: `calc(22% + ${ORB_X * 60}cqh)`,
          bottom: `${(WANDERER_BOTTOM + 0.01) * 100}%`,
          width: "46cqh",
          height: "7cqh",
          transform: "translate(-50%, 50%)",
          background: `radial-gradient(ellipse, ${glow}38, ${glow}12 45%, transparent 72%)`,
        }}
      />
      <Wanderer
        glow={glow}
        className="wanderer absolute aspect-[3/5]"
        style={{ left: "22%", height: `${WANDERER_HEIGHT * 100}%`, bottom: `${WANDERER_BOTTOM * 100}%` }}
      />
      {/* 目の前を漂う、ピントの合わない光の粒 */}
      {BOKEH.map((b, i) => (
        <span
          key={i}
          className="expedition-bokeh pointer-events-none absolute rounded-full"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: `${b.size}cqh`,
            height: `${b.size}cqh`,
            opacity: b.o,
            background: `radial-gradient(circle, ${scene.motes.color} 0, ${scene.motes.color}aa 40%, ${scene.motes.color}22 62%, transparent 70%)`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      {/* 四隅を沈め、重ねる時計や札を読みやすくする */}
      <div className="absolute inset-0 shadow-[inset_0_0_80px_20px_rgba(3,4,10,0.75)]" />
    </div>
  );
});
