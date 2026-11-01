"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { soundManager } from "@/lib/sound/sound-manager";
import { ambienceParts, playAmbiencePart, startAmbience, type AmbienceVoice } from "@/lib/sound/ambience";
import { loadPiano, SONGS, songLayout, startSong, type SongKey, type SongVoice } from "@/lib/sound/music";

const TRACKS: { key: SongKey; name: string; en: string }[] = [
  { key: "title", name: "タイトル", en: "Title" },
  { key: "prelude", name: "旅立ちの前", en: "Prelude" },
  { key: "hearth", name: "小屋", en: "Hearth" },
  { key: "forest", name: "樹海・図書室", en: "Forest" },
  { key: "stars", name: "観測塔・星空", en: "Stars" },
  { key: "frost", name: "氷の回廊", en: "Frost" },
  { key: "forge", name: "魔導炉", en: "Forge" },
  { key: "sanctum", name: "大聖堂", en: "Sanctum" },
  { key: "zenith", name: "星天の塔", en: "Zenith" },
];

const LENGTHS = [15, 30, 60, 120] as const;
const SAMPLE_RATE = 48000;
const FADE_SEC = 2;

type From = "intro" | "chorus";
/** 曲を流すか（環境音を重ねるかは別に選ぶ）、環境音だけを流すか */
type Mode = "song" | "ambience";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** 曲を OfflineAudioContext で描き出し、WAV（16bit ステレオ）にする */
async function renderWav(key: SongKey, from: From, seconds: number, ambience: boolean) {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE * seconds, SAMPLE_RATE);
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(1, seconds - FADE_SEC);
  fade.gain.linearRampToValueAtTime(0, seconds);
  fade.connect(ctx.destination);
  await loadPiano(ctx);
  startSong(ctx, fade, key, { from, duration: seconds });
  if (ambience) startAmbience(ctx, fade, key, { duration: seconds });
  const buffer = await ctx.startRendering();
  // 動画で使うので、いちばん大きいところが -1 dBFS になるよう持ち上げる
  let peak = 0;
  for (let c = 0; c < 2; c++) for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.89 / peak : 1;

  const frames = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + frames * 4));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * 4, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 4, true);
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i] * gain));
      view.setInt16(44 + i * 4 + c * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
  return new Blob([view], { type: "audio/wav" });
}

/**
 * 再生バー: 1巡目（前奏〜間奏）の長さに、段の区切りと名前を描く。押した（なぞった）位置の小節から鳴らし直す。
 * 2巡目以降は、間奏の後に A メロの頭へ戻って進む
 */
function PlaybackBar({ songKey, position, onSeek }: { songKey: SongKey; position: number | null; onSeek: (bar: number) => void }) {
  const layout = songLayout(songKey);
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? position ?? 0;
  const ratio = Math.min(1, shown / layout.seconds);

  const barAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(layout.bars - 1, Math.floor(((e.clientX - rect.left) / rect.width) * layout.bars)));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="slider"
        aria-label="再生位置"
        aria-valuemin={0}
        aria-valuemax={Math.round(layout.seconds)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${clock(shown)} / ${clock(layout.seconds)}`}
        tabIndex={0}
        className="relative h-9 cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(barAt(e) * layout.barSec);
        }}
        onPointerMove={(e) => dragging !== null && setDragging(barAt(e) * layout.barSec)}
        onPointerUp={(e) => {
          setDragging(null);
          onSeek(barAt(e));
        }}
        onKeyDown={(e) => {
          const bar = Math.floor(shown / layout.barSec);
          if (e.key === "ArrowRight") onSeek(Math.min(layout.bars - 1, bar + 1));
          if (e.key === "ArrowLeft") onSeek(Math.max(0, bar - 1));
        }}
      >
        {/* 段の区切りと名前 */}
        {layout.sections.map((s) => (
          <div
            key={s.from}
            className="absolute top-0 bottom-0 border-l border-white/15 first:border-l-0"
            style={{ left: `${(s.from / layout.bars) * 100}%`, width: `${(s.bars / layout.bars) * 100}%` }}
          >
            <span className="absolute top-0 left-1 text-[9px] tracking-wider whitespace-nowrap text-muted-foreground">{s.label}</span>
          </div>
        ))}
        <div className="absolute right-0 bottom-1.5 left-0 h-1 rounded-full bg-white/10" />
        <div className="absolute bottom-1.5 left-0 h-1 rounded-full bg-starlight/70" style={{ width: `${ratio * 100}%` }} />
        <div
          className="absolute bottom-0.5 size-3 -translate-x-1/2 rounded-full bg-starlight shadow-[0_0_8px_rgba(226,201,116,0.7)]"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
      <div className="flex justify-between font-display text-[10px] tracking-wider text-muted-foreground">
        <span>{clock(shown)}</span>
        <span>{clock(layout.seconds)}</span>
      </div>
    </div>
  );
}

/** 曲の試聴と、動画用の WAV 書き出し */
export function MusicPlayer() {
  const [playing, setPlaying] = useState<{ key: SongKey; mode: Mode } | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [from, setFrom] = useState<From>("chorus");
  const [seconds, setSeconds] = useState<(typeof LENGTHS)[number]>(30);
  const [rendering, setRendering] = useState<SongKey | null>(null);
  const [ambience, setAmbience] = useState(true);
  const audio = useRef<{ ctx: AudioContext; key: SongKey; song: SongVoice | null; ambience: AmbienceVoice | null } | null>(null);

  // 環境音の素材を1つずつ鳴らす（曲とは別の AudioContext。鳴らしている素材は少しのあいだ光らせる）
  const [preview, setPreview] = useState<{ key: SongKey; index: number } | null>(null);
  const previewAudio = useRef<{ ctx: AudioContext; stop: (() => void) | null; timer: ReturnType<typeof setTimeout> | null } | null>(null);

  const playPart = (key: SongKey, index: number, kind: "bed" | "event") => {
    if (!previewAudio.current) previewAudio.current = { ctx: new AudioContext(), stop: null, timer: null };
    const current = previewAudio.current;
    current.stop?.();
    if (current.timer) clearTimeout(current.timer);
    current.stop = playAmbiencePart(current.ctx, current.ctx.destination, key, index);
    setPreview({ key, index });
    current.timer = setTimeout(() => setPreview(null), kind === "bed" ? 8000 : 2500);
  };

  const release = () => {
    audio.current?.song?.stop();
    audio.current?.ambience?.stop();
    void audio.current?.ctx.close();
    audio.current = null;
  };

  // アプリの環境音と重ならないようにする
  useEffect(() => {
    soundManager.setSilenced(true);
    return () => {
      soundManager.setSilenced(false);
      release();
      previewAudio.current?.stop?.();
      void previewAudio.current?.ctx.close();
    };
  }, []);

  // 再生中は、いまの位置をバーに映し続ける
  useEffect(() => {
    if (!playing) return;
    let raf = requestAnimationFrame(function tick() {
      setPosition(audio.current?.song?.position() ?? null);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const stop = () => {
    release();
    setPlaying(null);
    setPosition(null);
  };

  const play = (key: SongKey, mode: Mode) => {
    release();
    const ctx = new AudioContext();
    audio.current = {
      ctx,
      key,
      song: mode === "song" ? startSong(ctx, ctx.destination, key, { from }) : null,
      ambience: mode === "ambience" || ambience ? startAmbience(ctx, ctx.destination, key) : null,
    };
    setPlaying({ key, mode });
  };

  const toggle = (key: SongKey, mode: Mode) => (playing?.key === key && playing.mode === mode ? stop() : play(key, mode));

  /** 曲だけを、指定した小節から鳴らし直す（環境音は流したまま） */
  const seek = (bar: number) => {
    const current = audio.current;
    if (!current?.song) return;
    current.song.stop();
    current.song = startSong(current.ctx, current.ctx.destination, current.key, { from: bar });
  };

  const download = async (key: SongKey) => {
    setRendering(key);
    try {
      const blob = await renderWav(key, from, seconds, ambience);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maholog-${key}-${from}-${seconds}s${ambience ? "" : "-music"}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setRendering(null);
    }
  };

  const isPlaying = (key: SongKey, mode: Mode) => playing?.key === key && playing.mode === mode;

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-starlight/60 text-starlight" : "border-white/15 text-muted-foreground hover:text-starlight"}`;

  return (
    // 画面全体は固定してあるので、この枠の中だけをスクロールさせる
    <div className="scroll-area scrollbar-none relative h-full">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10 text-sm">
        <h1 className="text-lg tracking-[0.2em] whitespace-nowrap text-starlight">曲の試聴と書き出し</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button className={chip(from === "intro")} onClick={() => setFrom("intro")}>
            最初から
          </button>
          <button className={chip(from === "chorus")} onClick={() => setFrom("chorus")}>
            サビの手前から
          </button>
          <span className="mx-2 h-4 w-px bg-white/15" />
          {LENGTHS.map((s) => (
            <button key={s} className={chip(seconds === s)} onClick={() => setSeconds(s)}>
              {s}秒
            </button>
          ))}
          <span className="mx-2 h-4 w-px bg-white/15" />
          <button className={chip(ambience)} onClick={() => setAmbience(!ambience)}>
            環境音を重ねる
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {TRACKS.map((track) => (
            <li key={track.key} className="flex flex-col gap-3 rounded-lg border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="whitespace-nowrap text-starlight">{track.name}</span>
                  <span className="text-[10px] tracking-[0.2em] text-muted-foreground">
                    {track.en} · {SONGS[track.key].bpm} BPM · {clock(songLayout(track.key).seconds)}
                  </span>
                </div>
                <button className={chip(isPlaying(track.key, "song"))} onClick={() => toggle(track.key, "song")}>
                  {isPlaying(track.key, "song") ? "止める" : "再生"}
                </button>
                <button className={chip(isPlaying(track.key, "ambience"))} onClick={() => toggle(track.key, "ambience")}>
                  {isPlaying(track.key, "ambience") ? "止める" : "環境音だけ"}
                </button>
                <button className={chip(false)} disabled={rendering !== null} onClick={() => void download(track.key)}>
                  {rendering === track.key ? "書き出し中…" : "WAV"}
                </button>
              </div>
              {isPlaying(track.key, "song") && <PlaybackBar songKey={track.key} position={position} onSeek={seek} />}
            </li>
          ))}
        </ul>
        <section className="flex flex-col gap-3">
          <h2 className="flex flex-col leading-tight tracking-[0.2em] whitespace-nowrap text-starlight">
            環境音の素材
            <span className="font-display text-[9px] tracking-[0.25em] text-starlight/60">AMBIENT SOUNDS</span>
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            その場所で使っている音を、曲のタイミングと関係なく1つずつ鳴らします。曲の後ろではとても小さく鳴らしているので、ここでは大きくして聴かせます。続く音（うなり）は8秒で消えます。
          </p>
          <ul className="flex flex-col gap-2">
            {TRACKS.map((track) => (
              <li key={track.key} className="flex flex-col gap-2 rounded-lg border border-white/10 px-4 py-3">
                <span className="whitespace-nowrap text-starlight">{track.name}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ambienceParts(track.key).map((part, index) => (
                    <button
                      key={part.label + index}
                      className={chip(preview?.key === track.key && preview.index === index)}
                      onClick={() => playPart(track.key, index, part.kind)}
                    >
                      {part.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-xs leading-relaxed text-muted-foreground">
          「環境音だけ」はその場所の環境音を単体で流します。再生中はバーを押すか、なぞった位置の小節から鳴らし直せます。WAV は選んだ位置・長さで書き出し、終わりの{FADE_SEC}
          秒でフェードアウトし、音量をそろえます。1巡目の旋律は毎回同じです。
        </p>
      </div>
    </div>
  );
}
