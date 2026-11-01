"use client";

import { useEffect, useRef, useState } from "react";
import { soundManager } from "@/lib/sound/sound-manager";
import { startAmbience } from "@/lib/sound/ambience";
import {
  loadPiano,
  SONGS,
  startSong,
  type SongKey,
  type SongVoice,
} from "@/lib/sound/music";

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

/** 曲を OfflineAudioContext で描き出し、WAV（16bit ステレオ）にする */
async function renderWav(
  key: SongKey,
  from: "intro" | "chorus",
  seconds: number,
  ambience: boolean,
) {
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
  for (let c = 0; c < 2; c++)
    for (const v of buffer.getChannelData(c))
      peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.89 / peak : 1;

  const frames = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + frames * 4));
  const text = (at: number, s: string) =>
    [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
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

/** 曲の試聴と、動画用の WAV 書き出し（開発サーバーでだけ開く） */
export function MusicPlayer() {
  const [playing, setPlaying] = useState<SongKey | null>(null);
  const [from, setFrom] = useState<"intro" | "chorus">("chorus");
  const [seconds, setSeconds] = useState<(typeof LENGTHS)[number]>(30);
  const [rendering, setRendering] = useState<SongKey | null>(null);
  const [ambience, setAmbience] = useState(true);
  const audio = useRef<{ ctx: AudioContext; voices: SongVoice[] } | null>(null);

  // アプリの環境音と重ならないようにする
  useEffect(() => {
    soundManager.setSilenced(true);
    return () => {
      soundManager.setSilenced(false);
      audio.current?.voices.forEach((v) => v.stop());
      void audio.current?.ctx.close();
    };
  }, []);

  const stop = () => {
    audio.current?.voices.forEach((v) => v.stop());
    void audio.current?.ctx.close();
    audio.current = null;
    setPlaying(null);
  };

  const play = (key: SongKey) => {
    stop();
    const ctx = new AudioContext();
    const voices = [startSong(ctx, ctx.destination, key, { from })];
    if (ambience) voices.push(startAmbience(ctx, ctx.destination, key));
    audio.current = { ctx, voices };
    setPlaying(key);
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

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-starlight/60 text-starlight" : "border-white/15 text-muted-foreground hover:text-starlight"}`;

  return (
    // 画面全体は固定してあるので、この枠の中だけをスクロールさせる
    <div className="scroll-area scrollbar-none relative h-full">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10 text-sm">
        <h1 className="whitespace-nowrap text-lg tracking-[0.2em] text-starlight">
          曲の試聴と書き出し
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={chip(from === "intro")}
            onClick={() => setFrom("intro")}
          >
            最初から
          </button>
          <button
            className={chip(from === "chorus")}
            onClick={() => setFrom("chorus")}
          >
            サビの手前から
          </button>
          <span className="mx-2 h-4 w-px bg-white/15" />
          {LENGTHS.map((s) => (
            <button
              key={s}
              className={chip(seconds === s)}
              onClick={() => setSeconds(s)}
            >
              {s}秒
            </button>
          ))}
          <span className="mx-2 h-4 w-px bg-white/15" />
          <button
            className={chip(ambience)}
            onClick={() => setAmbience(!ambience)}
          >
            環境音を重ねる
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {TRACKS.map((track) => (
            <li
              key={track.key}
              className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="whitespace-nowrap text-starlight">
                  {track.name}
                </span>
                <span className="text-[10px] tracking-[0.2em] text-muted-foreground">
                  {track.en} · {SONGS[track.key].bpm} BPM
                </span>
              </div>
              <button
                className={chip(playing === track.key)}
                onClick={() =>
                  playing === track.key ? stop() : play(track.key)
                }
              >
                {playing === track.key ? "止める" : "再生"}
              </button>
              <button
                className={chip(false)}
                disabled={rendering !== null}
                onClick={() => void download(track.key)}
              >
                {rendering === track.key ? "書き出し中…" : "WAV"}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          WAV は選んだ位置・長さで書き出し、終わりの{FADE_SEC}
          秒でフェードアウトし、音量をそろえます。1巡目の旋律は毎回同じです。
        </p>
      </div>
    </div>
  );
}
