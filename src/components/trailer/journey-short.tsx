"use client";

import { useEffect } from "react";
import { ArcaneLogo } from "@/components/arcane-icons";
import { ExpeditionStage } from "@/components/expedition/expedition-stage";
import { EXPEDITION_SCENES, type ExpeditionSceneId } from "@/lib/expedition";
import { STAGES } from "@/lib/game";
import { loadPiano, startSong, type SongVoice } from "@/lib/sound/music";
import { ease, fade, ShortPlayer, veil } from "./trailer";

// TikTok「勉強した時間だけ、旅が進む。」。探索の景色の少女が歩き続け、STAGE 1 から 6 まで景色が少しずつ移り変わる。
// 予告編（trailer.tsx）と同じく、時刻 t（ms）だけで画面が決まるように組み、video/capture.mjs で撮る。
// 景色の CSS アニメーションはどれも撮影の時刻に揃えられるので、重ねた2つの舞台の少女はいつも同じ姿勢で、溶け合っても少女はぶれない

/** STAGE 1〜6 の舞台 */
const SCENES: ExpeditionSceneId[] = ["library", "forest", "observatory", "frost", "forge", "sanctum"];

// ---- 構成（ms） ----
/** 1つのステージを見せる長さ */
const SEG = 6000;
/** 次のステージへ溶け合わせる長さ（区切りの前後に半分ずつ） */
const BLEND = 2400;
/** 溶け合わせ始める少し前に次の舞台を置いておく（描き始めを溶け合わせの中に見せない） */
const PRELOAD = 1200;
const STAGES_END = SEG * SCENES.length;
const FINALE = { dim: [STAGES_END - 800, STAGES_END + 600], logo: [STAGES_END, STAGES_END + 1400], guide: [STAGES_END + 1200, STAGES_END + 2300] } as const;
/** 動画の長さ（ms） */
export const JOURNEY_SHORT_MS = STAGES_END + 6500;

/** 杖先の灯の色（どの舞台でも同じにし、溶け合わせても少女が変わらないように） */
const GLOW = "#f2c27a";

function Frame({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Scenes t={t} />
      <div className="pointer-events-none absolute inset-0 bg-[#03040a]" style={{ opacity: ease(t, FINALE.dim[0], FINALE.dim[1]) * 0.72 }} />
      <Headline t={t} />
      {SCENES.map((_, i) => (
        <StageLabel key={i} t={t} index={i} />
      ))}
      <Finale t={t} />
    </div>
  );
}

/** ステージ i の舞台の濃さ（その上に次の舞台を重ねて溶け合わせるので、自分の出番の後も下で見え続ける） */
function sceneOpacity(t: number, i: number) {
  if (i === 0) return 1;
  return ease(t, i * SEG - BLEND / 2, i * SEG + BLEND / 2);
}

/** 景色: いまの舞台と、溶け合わせ中の次の舞台だけを重ねて描く */
function Scenes({ t }: { t: number }) {
  return (
    <>
      {SCENES.map((id, i) => {
        const begin = i === 0 ? -Infinity : i * SEG - BLEND / 2 - PRELOAD;
        const end = i === SCENES.length - 1 ? Infinity : (i + 1) * SEG + BLEND / 2;
        if (t < begin || t > end) return null;
        return (
          <div key={id} className="absolute inset-0" style={{ opacity: sceneOpacity(t, i) }}>
            <ExpeditionStage scene={EXPEDITION_SCENES[id]} walking glow={GLOW} className="absolute inset-0" />
          </div>
        );
      })}
    </>
  );
}

/** 冒頭から終幕の手前まで出しておく一行（0秒目から読める） */
function Headline({ t }: { t: number }) {
  const opacity = 1 - ease(t, FINALE.dim[0], FINALE.dim[0] + 600);
  if (opacity <= 0) return null;
  return (
    <div className="absolute inset-x-0 top-[7%] flex flex-col items-center text-center" style={{ opacity }}>
      <p className="font-serif text-[25px] tracking-[0.16em] whitespace-nowrap text-starlight-gradient drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">
        <span className="-mr-[0.16em]">勉強した時間だけ、旅が進む。</span>
      </p>
    </div>
  );
}

/** ステージの名札: 名と、辿り着くまでの勉強時間 */
function StageLabel({ t, index }: { t: number; index: number }) {
  const start = index * SEG;
  const opacity = fade(t, [start + (index === 0 ? -1000 : 300), start + (index === 0 ? 0 : 1100), start + SEG - 900, start + SEG - 200]);
  if (opacity <= 0) return null;
  const stage = STAGES[index];
  return (
    <div className="absolute inset-x-0 top-[15%] flex flex-col items-center text-center drop-shadow-[0_0_8px_rgba(0,0,0,0.95)]" style={veil(opacity)}>
      <p className="font-display text-[11px] tracking-[0.5em] whitespace-nowrap text-starlight/80">
        <span className="-mr-[0.5em]">STAGE {stage.id}</span>
      </p>
      <p className="mt-2 font-serif text-[30px] leading-none tracking-[0.2em] whitespace-nowrap text-foreground">
        <span className="-mr-[0.2em]">{stage.name}</span>
      </p>
      <p className="mt-3 font-serif text-[14px] tracking-[0.2em] whitespace-nowrap text-starlight/85">
        <span className="-mr-[0.2em]">{stage.requiredHours === 0 ? "はじまりの場所" : `勉強 ${stage.requiredHours}時間で辿り着く`}</span>
      </p>
    </div>
  );
}

/** 終幕: 名と入口の案内（T02 と同じ） */
function Finale({ t }: { t: number }) {
  if (t < FINALE.logo[0]) return null;
  const logo = ease(t, FINALE.logo[0], FINALE.logo[1]);
  const guide = ease(t, FINALE.guide[0], FINALE.guide[1]);
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-[30%] flex flex-col items-center text-center" style={veil(logo)}>
        <p className="flex items-center gap-3 text-[12px] tracking-[0.5em] whitespace-nowrap text-starlight/75">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-starlight/60" />
          <span className="-mr-[0.5em]">勉強記録アプリ マホログ</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-starlight/60" />
        </p>
        <p className="title-logo mt-3 font-display text-[54px] leading-none font-medium tracking-[0.18em] text-starlight-gradient" data-t0={FINALE.logo[0]}>
          <span className="-mr-[0.18em]">MAHOLOG</span>
        </p>
        <p className="mt-3 font-display text-[9px] tracking-[0.3em] whitespace-nowrap text-starlight/55">
          <span className="-mr-[0.3em]">ARCANE OBSERVATORY FOR KNOWLEDGE</span>
        </p>
        <div className="mt-6 flex items-center gap-3 text-starlight/50">
          <span className="h-px w-14 bg-gradient-to-r from-transparent to-starlight/50" />
          <ArcaneLogo className="size-6 text-starlight/80 drop-shadow-[0_0_6px_rgba(226,201,116,0.5)]" />
          <span className="h-px w-14 bg-gradient-to-l from-transparent to-starlight/50" />
        </div>
      </div>
      <div className="absolute inset-x-0 top-[58%] flex flex-col items-center gap-1.5 text-center" style={veil(guide)}>
        <p className="font-serif text-[15px] tracking-[0.25em] whitespace-nowrap text-foreground/90">入口は、プロフィールとコメント欄のリンクから</p>
        <p className="font-display text-[9px] tracking-[0.4em] text-starlight/60">LINK IN PROFILE · COMMENTS</p>
      </div>
    </div>
  );
}

// ---- 音 ----
// 旅立ちの曲（prelude）を B メロの終わりから流し、すぐにサビを聴かせる。終わりに向けて静かに引く

function playSoundtrack(ctx: AudioContext, destination: AudioNode) {
  const master = ctx.createGain();
  master.connect(destination);
  const now = ctx.currentTime + 0.05;
  const at = (ms: number) => now + ms / 1000;
  master.gain.setValueAtTime(0.85, now);
  master.gain.setValueAtTime(0.85, at(JOURNEY_SHORT_MS - 2500));
  master.gain.linearRampToValueAtTime(0.0001, at(JOURNEY_SHORT_MS - 200));
  let voice: SongVoice | null = null;
  let stopped = false;
  void loadPiano(ctx).then(() => {
    if (!stopped) voice = startSong(ctx, master, "prelude", { from: "chorus" });
  });
  return () => {
    stopped = true;
    voice?.stop();
  };
}

export function JourneyShort() {
  // ピアノの音を先に読み込んでおき、録音の頭に無音が入らないようにする
  useEffect(() => {
    void loadPiano(new OfflineAudioContext(1, 1, 44100));
  }, []);
  return <ShortPlayer duration={JOURNEY_SHORT_MS} frame={(t) => <Frame t={t} />} play={playSoundtrack} />;
}
