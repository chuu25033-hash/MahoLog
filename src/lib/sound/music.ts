// 環境音（BGM）の作曲と演奏。音声ファイルを使わず、Web Audio API で曲を組み立てて流す。
//
// 主題は「孤独」と「夜空」。滅びた世界で、ひとりの観測者が星空を見上げながら刻を注ぐ ―― その部屋で鳴っている音楽。
// 作り直しの経緯:
//   オルゴール中心 → 子守歌・睡眠用に聞こえた / 弦の独奏と16分のピアノ → 昔の RPG のようで賑やかすぎた /
//   シンセのプラック・鋸歯波のパッド・FM のエレピ → 電子音がチープに聞こえた
//   合成したピアノ → 波形の合成ではエレピのように聞こえ、まだチープだった
// そこで音の主役を、録音したグランドピアノ一台にする（いまのローファイ・ピアノやネオクラシカルの作法）。
//  - ピアノ: Salamander Grand Piano（Alexander Holm、CC-BY 3.0）の録音を短3度おきに置き、間の音は再生速度で作る。
//    弱く弾くほど高域を落として、フェルトを挟んだような柔らかさにする。音の高さで左右に置き、広い部屋の長い響きへ送る。
//    録音を読み込めないときは、合成したピアノで代わりに鳴らす
//  - 繋がり: すべての曲の前奏と間奏に、同じ「観測者の主題」（観測塔の呼びかけ）を、その曲の調で鳴らす。
//    タイトルの曲はこの主題をサビの呼びかけにする
//  - 孤独: 左手は低い根音と、間を大きく空けた開いた和音。右手の旋律は一本だけで、休符を多く残す
//  - 夜空: 高い音域で、星が瞬くように小さな音がまばらに鳴る。遠くの響きに溶けていく
//  - 和声: maj7・m9・sus4・add9 など、解決しきらずに漂う和音。4小節の循環を繰り返す
//  - エリアごとの雰囲気: 響きの広さ（小屋は狭く近く、大聖堂は長く遠く）、ピアノの柔らかさ（小屋はフェルト、氷は硬く澄んで）、
//    打楽器の種類（ブラシ・ローファイ・重いキック・なし）、速さ、星の瞬きの多さを変える
//  - サビだけ、低い支えと打楽器を薄く足す。打楽器は一度だけ描いた音を鳴らし分け、スウィングでわずかに揺らす
//  - 旋律の素は曲ごとの種（seed）から決まる。1巡目はいつも同じ曲になり、2巡目からは少しずつ変える
import type { AmbienceKey } from "./sound-files";

const SILENT = 0.0001;
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

// ---------------------------------------------------------------- 和音

const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "6": [0, 4, 7, 9],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

type Chord = {
  /** 根音のピッチクラス（0 = C） */
  root: number;
  /** 構成音のピッチクラス */
  pcs: number[];
  /** 右手で鳴らす音（根音を抜き、5度を省いて色の音を残す） */
  color: number[];
};

const pitchClass = (name: string) => (LETTER[name[0]] + (name[1] === "#" ? 1 : name[1] === "b" ? 11 : 0)) % 12;

/** "Bbmaj7"・"F#m9"・"Asus4" のような和音名を読む */
function chord(name: string): Chord {
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  const tones = m ? QUALITIES[m[2]] : undefined;
  if (!m || !tones) throw new Error(`和音名を読めません: ${name}`);
  const root = pitchClass(m[1]);
  const pc = (t: number) => (root + t) % 12;
  const upper = tones.filter((t) => t !== 0);
  const color = upper.length > 3 ? upper.filter((t) => t !== 7) : upper;
  return { root, pcs: [...new Set(tones.map(pc))], color: [...new Set((color.length >= 2 ? color : tones).map(pc))] };
}

/** 1小節の和音: "Esus4 E" のように空白で区切ると、前半と後半で替わる */
type BarChords = { chord: Chord; from: number }[];
const barChords = (entry: string): BarChords => {
  const names = entry.split(" ");
  return names.map((name, i) => ({ chord: chord(name), from: (i * 16) / names.length }));
};
const chordIn = (bar: BarChords, step: number) => [...bar].reverse().find((c) => step >= c.from)!.chord;

// ---------------------------------------------------------------- 曲

const MAJOR_PENTA = [0, 2, 4, 7, 9];
const MINOR_PENTA = [0, 3, 5, 7, 10];

type SectionName = "intro" | "verse" | "pre" | "chorus" | "chorus2" | "interlude";

type Song = {
  bpm: number;
  /** 旋律に使う五音音階（主音のピッチクラスと、長調か短調か） */
  tonic: number;
  minor: boolean;
  /** 各段の4小節の和音の循環（8小節の段では2回繰り返す） */
  verse: string[];
  pre: string[];
  chorus: string[];
  interlude: string[];
  /** 16分の裏拍を遅らせる割合（0〜0.3 ほど） */
  swing: number;
  /** 旋律の中心の高さ（MIDI） */
  center: number;
  /** 打楽器の組み合わせと強さ（null なら鳴らさない） */
  kit: Kit | null;
  drums: number;
  /** 響き: 残響の長さ（秒）と、送る量の倍率 */
  room: { seconds: number; wet: number };
  /** ピアノの明るさの倍率（小さいほどフェルトを挟んだように丸く、大きいほど硬く澄む） */
  felt: number;
  /** 星の瞬きの多さ（1小節あたりの平均の音数） */
  stars: number;
  /** 旋律の素 */
  seed: number;
};

export type SongKey = AmbienceKey;

/** 打楽器の組み合わせ。brush: ブラシで叩く / lofi: クロススティックと金物 / deep: 重いキックとスネア */
type Kit = "brush" | "lofi" | "deep";

export const SONGS: Record<SongKey, Song> = {
  // タイトル: イ短調。Am9 → Fmaj7 → Cmaj7 → G6 の、ひとりで夜を見上げる循環
  title: {
    bpm: 74,
    tonic: 9,
    minor: true,
    verse: ["Am9", "Fmaj7", "Cmaj7", "G6"],
    pre: ["Dm9", "Em7", "Fmaj7", "Gsus4"],
    chorus: ["Fmaj7", "G6", "Em7", "Am9"],
    interlude: ["Am9", "Am9", "Fmaj7", "Fmaj7"],
    swing: 0.18,
    center: 76,
    kit: "lofi",
    drums: 0.8,
    room: { seconds: 4.2, wet: 1 },
    felt: 1,
    stars: 0.8,
    seed: 1207,
  },
  // 旅立ちの前（星天の導き）: ニ長調。まだ見ぬ星へ向かう、少しだけ明るい孤独
  prelude: {
    bpm: 78,
    tonic: 2,
    minor: false,
    verse: ["Dmaj7", "Bm9", "Gmaj7", "Asus4"],
    pre: ["Em9", "F#m7", "Gmaj7", "Asus4"],
    chorus: ["Gmaj7", "A6", "F#m7", "Bm9"],
    interlude: ["Gmaj7", "Gmaj7", "Dmaj7", "Dmaj7"],
    swing: 0.15,
    center: 74,
    kit: "lofi",
    drums: 0.65,
    room: { seconds: 3.6, wet: 0.95 },
    felt: 1.05,
    stars: 0.7,
    seed: 311,
  },
  // 小屋: 変ホ長調。暖炉の残り火のそばで、ひとり静かに
  hearth: {
    bpm: 70,
    tonic: 3,
    minor: false,
    verse: ["Ebmaj7", "Cm9", "Abmaj7", "Bbsus4"],
    pre: ["Fm9", "Gm7", "Abmaj7", "Bb6"],
    chorus: ["Abmaj7", "Gm7", "Cm9", "Bbsus4"],
    interlude: ["Abmaj7", "Abmaj7", "Ebmaj7", "Ebmaj7"],
    swing: 0.22,
    center: 75,
    kit: "brush",
    drums: 0.7,
    room: { seconds: 1.6, wet: 0.65 },
    felt: 0.72,
    stars: 0.4,
    seed: 4021,
  },
  // 樹海・図書室: イ短調のドリア。i → IV が揺れ続ける、深い森と古い本の静けさ
  forest: {
    bpm: 72,
    tonic: 9,
    minor: true,
    verse: ["Am9", "Dadd9", "Am9", "Dadd9"],
    pre: ["Fmaj7", "Em7", "Dm9", "Esus4"],
    chorus: ["Dm9", "Em7", "Fmaj7", "Esus4 E"],
    interlude: ["Am9", "Am9", "Dadd9", "Dadd9"],
    swing: 0.2,
    center: 76,
    kit: "brush",
    drums: 0.65,
    room: { seconds: 3.2, wet: 0.95 },
    felt: 0.85,
    stars: 0.5,
    seed: 777,
  },
  // 観測塔・星空: ホ長調。いちばん星に近い場所。瞬きをいちばん多くする
  stars: {
    bpm: 76,
    tonic: 4,
    minor: false,
    verse: ["Emaj7", "C#m9", "Amaj7", "Bsus4"],
    pre: ["F#m9", "G#m7", "Amaj7", "Bsus4"],
    chorus: ["Amaj7", "B6", "G#m7", "C#m9"],
    interlude: ["Amaj7", "Amaj7", "Emaj7", "Emaj7"],
    swing: 0.15,
    center: 78,
    kit: "lofi",
    drums: 0.7,
    room: { seconds: 5.2, wet: 1.15 },
    felt: 1.05,
    stars: 1.3,
    seed: 2468,
  },
  // 氷の回廊: ロ短調。凍った空気の中で、音がどこまでも遠く響く
  frost: {
    bpm: 64,
    tonic: 11,
    minor: true,
    verse: ["Bm9", "Gmaj7", "Em9", "F#m7"],
    pre: ["Em9", "F#m7", "Gmaj7", "Asus4"],
    chorus: ["Em9", "Asus4", "Dmaj7", "Gmaj7"],
    interlude: ["Bm9", "Bm9", "Gmaj7", "Gmaj7"],
    swing: 0.12,
    center: 77,
    kit: null,
    drums: 0,
    room: { seconds: 6.5, wet: 1.3 },
    felt: 1.25,
    stars: 1,
    seed: 5150,
  },
  // 魔導炉: ハ短調。いちばん前へ進むが、それでもひとり
  forge: {
    bpm: 84,
    tonic: 0,
    minor: true,
    verse: ["Cm9", "Abmaj7", "Fm9", "Gm7"],
    pre: ["Abmaj7", "Bbsus4", "Gm7", "Cm9"],
    chorus: ["Fm9", "Bb6", "Ebmaj7", "Abmaj7"],
    interlude: ["Cm9", "Cm9", "Abmaj7", "Abmaj7"],
    swing: 0.12,
    center: 74,
    kit: "deep",
    drums: 1,
    room: { seconds: 2.4, wet: 0.8 },
    felt: 0.8,
    stars: 0.3,
    seed: 9001,
  },
  // 大聖堂: ヘ長調。高い天井の下で、祈るように。打楽器は鳴らさない
  sanctum: {
    bpm: 62,
    tonic: 5,
    minor: false,
    verse: ["Fmaj7", "Dm9", "Bbmaj7", "Csus4"],
    pre: ["Gm9", "Am7", "Bbmaj7", "C6"],
    chorus: ["Bbmaj7", "C6", "Am7", "Dm9"],
    interlude: ["Fmaj7", "Bbmaj7", "Fmaj7", "Bbmaj7"],
    swing: 0.1,
    center: 74,
    kit: null,
    drums: 0,
    room: { seconds: 7.5, wet: 1.4 },
    felt: 0.95,
    stars: 0.8,
    seed: 8086,
  },
  // 星天の塔: ロ長調。果てのない塔を、ひとりで昇り続ける。サビの呼びかけは観測者の主題そのもの
  zenith: {
    bpm: 68,
    tonic: 11,
    minor: false,
    verse: ["Emaj7", "F#sus4", "G#m9", "G#m9"],
    pre: ["C#m9", "D#m7", "Emaj7", "F#sus4"],
    chorus: ["Emaj7", "F#6", "D#m7", "G#m9"],
    interlude: ["Bmaj7", "Bmaj7", "Emaj7", "Emaj7"],
    swing: 0.08,
    center: 78,
    kit: null,
    drums: 0,
    room: { seconds: 6.5, wet: 1.3 },
    felt: 1.1,
    stars: 1.6,
    seed: 1010,
  },
};

/** 観測者の主題を取る曲（すべての曲の前奏・間奏で、この曲のフックの呼びかけを鳴らす） */
const MOTIF_SONG: SongKey = "stars";

/** 曲の形。前奏は最初の一度だけで、あとは A メロから間奏までを巡る */
const INTRO_BARS = 4;
const CYCLE: SectionName[] = ["verse", "pre", "chorus", "chorus2", "interlude"];
const SECTION_BARS = 8;
const CYCLE_BARS = CYCLE.length * SECTION_BARS;

// ---------------------------------------------------------------- 乱数

/** 種から決まる乱数（mulberry32） */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const pickFrom = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length)];

/** 演奏の揺らぎ（毎回変わってよいので Math.random） */
const humanize = () => (Math.random() - 0.5) * 0.014;
const wobble = () => 0.88 + Math.random() * 0.24;

// ---------------------------------------------------------------- 音の流れ

type Mix = {
  ctx: BaseAudioContext;
  piano: AudioNode;
  /** 星の瞬き（響きへ多めに送る） */
  far: AudioNode;
  bass: AudioNode;
  drums: AudioNode;
  /** 全体のこもり具合（前奏で少しずつ開き、間奏で遠のく） */
  tone: BiquadFilterNode;
  /** ピアノの明るさの倍率 */
  felt: number;
  waves: { warm: PeriodicWave; bright: PeriodicWave };
  stop: () => void;
};

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** 広い部屋の残響: 左右で別々に、ゆっくり暗くなりながら減衰するノイズ */
function hallImpulse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const p = i / length;
      smooth += (0.5 - p * 0.42) * (Math.random() * 2 - 1 - smooth);
      data[i] = smooth * (1 - p) ** 2.2;
    }
  }
  return buffer;
}

/** 古い録音のような、ごく薄いヒス */
function hissBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < data.length; i++) {
    smooth += 0.1 * (Math.random() * 2 - 1 - smooth);
    data[i] = smooth * 0.3 + (Math.random() < 0.00012 ? (Math.random() * 2 - 1) * 0.4 : 0);
  }
  return buffer;
}

/** 倍音の重みから波形を作る */
const wave = (ctx: BaseAudioContext, amps: number[]) => {
  const real = new Float32Array(amps.length + 1);
  const imag = new Float32Array([0, ...amps]);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
};

/** 音の流れ: 各楽器 → [遠い響きへも送る] → 全体のこもり → まとめ（軽く圧縮）→ out */
function createMix(ctx: BaseAudioContext, out: AudioNode, song: Song): Mix {
  const sum = ctx.createGain();
  sum.gain.value = 0.95;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = OPEN;
  tone.Q.value = 0.5;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -24;
  glue.knee.value = 14;
  glue.ratio.value = 2;
  glue.attack.value = 0.02;
  glue.release.value = 0.3;
  sum.connect(tone).connect(glue).connect(out);

  // 遠い響き: 少し遅れて立ち上がる長い残響
  const preDelay = ctx.createDelay(0.2);
  preDelay.delayTime.value = 0.035;
  const hall = ctx.createConvolver();
  hall.buffer = hallImpulse(ctx, song.room.seconds);
  const hallTone = ctx.createBiquadFilter();
  hallTone.type = "lowpass";
  hallTone.frequency.value = 3600;
  preDelay.connect(hall).connect(hallTone).connect(sum);

  const lane = (send: number, ...filters: BiquadFilterNode[]) => {
    const input = ctx.createGain();
    let node: AudioNode = input;
    for (const f of filters) node = node.connect(f);
    node.connect(sum);
    const s = ctx.createGain();
    s.gain.value = send;
    node.connect(s).connect(preDelay);
    return input;
  };
  const filter = (type: BiquadFilterType, frequency: number, Q?: number) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    if (Q !== undefined) f.Q.value = Q;
    return f;
  };

  // 古い録音のヒス
  const hiss = ctx.createBufferSource();
  hiss.buffer = hissBuffer(ctx);
  hiss.loop = true;
  const hissLevel = ctx.createGain();
  hissLevel.gain.value = 0.012;
  hiss.connect(filter("bandpass", 3000, 0.4)).connect(hissLevel).connect(sum);
  hiss.start();

  return {
    ctx,
    piano: lane(0.42 * song.room.wet),
    far: lane(1.1 * song.room.wet, filter("lowpass", 5000)),
    bass: lane(0, filter("lowpass", 240)),
    drums: lane(0.18 * song.room.wet, filter("highpass", 35), filter("lowpass", 7500)),
    tone,
    felt: song.felt,
    waves: {
      // ピアノの芯（低い倍音中心）と、打鍵の瞬間の明るさ（高い倍音まで）
      warm: wave(ctx, [1, 0.42, 0.2, 0.1, 0.05, 0.025, 0.012]),
      bright: wave(ctx, [1, 0.75, 0.55, 0.42, 0.32, 0.24, 0.17, 0.12, 0.085, 0.06, 0.04, 0.03]),
    },
    stop: () => {
      try {
        hiss.stop();
      } catch {}
    },
  };
}

// ---------------------------------------------------------------- 楽器

/** 録音したピアノの音（A1〜C8 を短3度おき。public/sounds/piano/） */
const SAMPLE_NOTES = Array.from({ length: 26 }, (_, i) => 33 + i * 3);
const sampleUrl = (note: number) =>
  `/sounds/piano/${({ 0: "C", 3: "Ds", 6: "Fs", 9: "A" } as Record<number, string>)[note % 12]}${Math.floor(note / 12) - 1}.mp3`;

let bank: Map<number, AudioBuffer> | null = null;
let loading: Promise<boolean> | null = null;

/**
 * 録音したピアノを読み込む（一度だけ。読み込んだ音はどの AudioContext でも使える）。
 * 1つでも読めなければ false を返し、合成したピアノで鳴らす
 */
export function loadPiano(ctx: BaseAudioContext): Promise<boolean> {
  if (!loading)
    loading = Promise.all(
      SAMPLE_NOTES.map(async (note) => {
        const res = await fetch(sampleUrl(note));
        if (!res.ok) throw new Error(`${res.status}`);
        return [note, await ctx.decodeAudioData(await res.arrayBuffer())] as const;
      }),
    )
      .then((entries) => {
        bank = new Map(entries);
        return true;
      })
      .catch(() => {
        loading = null;
        return false;
      });
  return loading;
}

/**
 * ピアノの1音。hold は鍵盤を押さえている長さ（省くとペダルを踏んだまま、自然に消えるまで）。
 * 録音があれば録音で、無ければ合成で鳴らす
 */
function piano(mix: Mix, note: number, at: number, velocity: number, hold?: number, out: AudioNode = mix.piano) {
  if (!bank) return synthPiano(mix, note, at, velocity, hold, out);
  const { ctx } = mix;
  const base = SAMPLE_NOTES.reduce((best, n) => (Math.abs(n - note) < Math.abs(best - note) ? n : best));
  const buffer = bank.get(base)!;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 2 ** ((note - base) / 12);
  // 弱く弾くほど高域を落とす（録音は強めの打鍵なので、フェルトを挟んだ柔らかさに寄せる）
  const felt = ctx.createBiquadFilter();
  felt.type = "lowpass";
  felt.frequency.value = Math.min(18000, (1400 + 9000 * velocity ** 1.6) * mix.felt);
  felt.Q.value = 0.3;
  const gain = ctx.createGain();
  const level = 0.42 * velocity ** 1.3;
  const ringFor = buffer.duration / src.playbackRate.value;
  const release = hold === undefined ? ringFor : Math.min(ringFor, hold);
  gain.gain.setValueAtTime(level, at);
  // 鍵盤を離すと、ダンパーが弦を押さえて素早く消える
  gain.gain.setValueAtTime(level, at + release);
  gain.gain.setTargetAtTime(0, at + release, 0.12);
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-0.45, Math.min(0.45, (note - 64) / 40));
  src.connect(felt).connect(gain).connect(pan).connect(out);
  src.start(at);
  src.stop(at + release + 0.8);
}

/**
 * 合成したピアノ（録音を読み込めないとき）: 1音を2本の弦（わずかにずらしてうならせる）で鳴らす。
 * 芯の音は長く残り、打鍵の明るさはすぐ消える。弱く弾くほど丸く（フェルトを挟んだように）なる。
 * hold は鍵盤を押さえている長さ（ペダルを踏んでいれば自然に消えるまで）
 */
function synthPiano(mix: Mix, note: number, at: number, velocity: number, hold: number | undefined, out: AudioNode) {
  const { ctx } = mix;
  const f = midi(note);
  // 低い音ほど長く響く（C2 で約9秒、C4 で約4.5秒、C6 で約2.2秒）
  const ring = 9 * 2 ** (-(note - 36) / 24);
  const length = Math.min(ring, hold ?? ring);
  const end = at + length + 0.3;
  const peak = 0.09 * velocity;

  const felt = ctx.createBiquadFilter();
  felt.type = "lowpass";
  felt.frequency.setValueAtTime(Math.min(f * 12, 900 + 4200 * velocity), at);
  felt.frequency.exponentialRampToValueAtTime(Math.min(f * 6, 700 + 1600 * velocity), at + 0.5);
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-0.45, Math.min(0.45, (note - 64) / 40));
  felt.connect(pan).connect(out);

  const strings = note > 88 ? [0] : [-0.9 + Math.random() * 0.3, 1 + Math.random() * 0.3];
  for (const detune of strings) {
    for (const layer of ["warm", "bright"] as const) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(mix.waves[layer]);
      osc.frequency.value = f;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      const level = (layer === "warm" ? peak : peak * 0.5 * velocity) / strings.length;
      const fade = layer === "warm" ? length : Math.min(length, ring * 0.12 + 0.08);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.005);
      if (layer === "warm") gain.gain.exponentialRampToValueAtTime(level * 0.4, at + Math.min(fade * 0.5, ring * 0.12));
      gain.gain.exponentialRampToValueAtTime(SILENT, at + fade + 0.25);
      osc.connect(gain).connect(felt);
      osc.start(at);
      osc.stop(end);
    }
  }

  // ハンマーの小さな打音
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const knock = ctx.createBiquadFilter();
  knock.type = "bandpass";
  knock.frequency.value = Math.min(2400, Math.max(400, f * 2));
  knock.Q.value = 1.2;
  const knockGain = ctx.createGain();
  knockGain.gain.setValueAtTime(peak * 0.25 * velocity, at);
  knockGain.gain.exponentialRampToValueAtTime(SILENT, at + 0.02);
  src.connect(knock).connect(knockGain).connect(pan);
  src.start(at, Math.random(), 0.03);
}

/** 低い支え: 正弦波。ピアノの左手の下で、聞こえるよりも感じる程度に */
function bass(mix: Mix, note: number, at: number, duration: number, velocity: number) {
  const { ctx } = mix;
  const peak = 0.06 * velocity;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.03);
  gain.gain.setValueAtTime(peak, at + duration);
  gain.gain.linearRampToValueAtTime(0, at + duration + 0.15);
  gain.connect(mix.bass);
  const osc = ctx.createOscillator();
  osc.frequency.value = midi(note);
  osc.connect(gain);
  osc.start(at);
  osc.stop(at + duration + 0.2);
}

// ---- 打楽器: JS で一度だけ描いた音を、鳴らすたびにわずかに速さを変えて鳴らす

type DrumSound = "kick" | "tap" | "hat" | "openHat" | "rim" | "shaker";

/** 2次の IIR フィルター（RBJ の式）。打楽器の音を描くときにだけ使う */
function biquad(type: "lowpass" | "highpass" | "bandpass", freq: number, q: number, sampleRate: number) {
  const w = (2 * Math.PI * freq) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const [b0, b1, b2] =
    type === "lowpass"
      ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
      : type === "highpass"
        ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
        : [alpha, 0, -alpha];
  const [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  return (x: number) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    return y;
  };
}

const drumBuffers = new WeakMap<BaseAudioContext, Record<DrumSound, AudioBuffer>>();

function drumKit(ctx: BaseAudioContext) {
  let kit = drumBuffers.get(ctx);
  if (kit) return kit;
  const sr = ctx.sampleRate;
  const draw = (seconds: number, sample: (t: number) => number) => {
    const buffer = ctx.createBuffer(1, Math.ceil(sr * seconds), sr);
    const data = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs((data[i] = sample(i / sr))));
    for (let i = 0; i < data.length; i++) data[i] /= peak || 1;
    return buffer;
  };
  const white = () => Math.random() * 2 - 1;
  // 金物: 互いに割り切れない高さの矩形波を重ね、高いところだけを残す（ノイズより金属らしく鳴る）
  const metal = (decay: number) => {
    const bp = biquad("bandpass", 10000, 1, sr);
    const hp = biquad("highpass", 7000, 0.7, sr);
    const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800];
    return (t: number) => hp(bp(freqs.reduce((sum, f) => sum + Math.sign(Math.sin(2 * Math.PI * f * t)), 0) / 6)) * Math.exp(-t / decay);
  };
  kit = {
    // 胴の低い鳴りと、ビーターが当たる小さな音。わずかに歪ませて丸める
    kick: (() => {
      let phase = 0;
      const click = biquad("lowpass", 2500, 0.7, sr);
      return draw(0.5, (t) => {
        phase += (2 * Math.PI * (46 + 74 * Math.exp(-t / 0.025))) / sr;
        const body = Math.sin(phase) * Math.exp(-t / 0.18) + 0.12 * Math.sin(2 * phase) * Math.exp(-t / 0.04);
        return Math.tanh(1.4 * (body + click(white()) * Math.exp(-t / 0.004) * 0.25));
      });
    })(),
    // ブラシで叩く: 擦れた音と、スネアの胴の鳴り
    tap: (() => {
      const bp = biquad("bandpass", 2400, 0.6, sr);
      return draw(0.35, (t) => bp(white()) * Math.min(1, t / 0.003) * Math.exp(-t / 0.09) + 0.25 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.06));
    })(),
    hat: draw(0.2, metal(0.022)),
    openHat: draw(0.7, metal(0.13)),
    // クロススティック: 木の縁を打つ乾いた音
    rim: (() => {
      const bp = biquad("bandpass", 3500, 1, sr);
      return draw(
        0.12,
        (t) =>
          0.6 * Math.sin(2 * Math.PI * 1650 * t) * Math.exp(-t / 0.01) +
          0.4 * Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t / 0.018) +
          0.5 * bp(white()) * Math.exp(-t / 0.003),
      );
    })(),
    shaker: (() => {
      const bp = biquad("bandpass", 6200, 1.4, sr);
      return draw(0.15, (t) => bp(white()) * (t < 0.015 ? t / 0.015 : Math.exp(-(t - 0.015) / 0.035)));
    })(),
  };
  drumBuffers.set(ctx, kit);
  return kit;
}

/** 打楽器ごとの大きさ */
const DRUM_LEVEL: Record<DrumSound, number> = { kick: 0.24, tap: 0.08, hat: 0.026, openHat: 0.02, rim: 0.05, shaker: 0.022 };

function playDrum(mix: Mix, sound: DrumSound, at: number, velocity: number) {
  const { ctx } = mix;
  const src = ctx.createBufferSource();
  src.buffer = drumKit(ctx)[sound];
  src.playbackRate.value = sound === "kick" ? 0.99 + Math.random() * 0.02 : 0.96 + Math.random() * 0.08;
  const gain = ctx.createGain();
  gain.gain.value = DRUM_LEVEL[sound] * velocity;
  src.connect(gain).connect(mix.drums);
  src.start(at);
}

// ---------------------------------------------------------------- 和声の扱い

/** 前の和音から動きが少なく、from 以上の1オクターブに収まる密集配置 */
function voiceChord(pcs: number[], prev: number[], from: number) {
  const mean = (v: number[]) => v.reduce((s, n) => s + n, 0) / v.length;
  const target = prev.length ? mean(prev) : from + 6;
  let best: number[] = [];
  let bestScore = Infinity;
  for (const lowPc of pcs) {
    const low = from + ((lowPc - from + 120) % 12);
    const voicing = pcs.map((pc) => low + ((pc - lowPc + 12) % 12)).sort((x, y) => x - y);
    const score = Math.abs(mean(voicing) - target) + 0.35 * Math.abs(mean(voicing) - (from + 6));
    if (score < bestScore) [best, bestScore] = [voicing, score];
  }
  return best;
}

/** 左手の根音（C2〜B2） */
const lowRoot = (c: Chord) => 36 + c.root;

/** 和音の上で旋律に使う音（MIDI 昇順）: 五音音階と和音の音から、和音の半音上にぶつかる音を外す */
function melodyNotes(penta: number[], c: Chord, lo: number, hi: number) {
  const clash = (pc: number) => c.pcs.some((t) => (pc - t + 12) % 12 === 1);
  const pcs = new Set([...c.pcs, ...penta].filter((pc) => !clash(pc)));
  const notes: number[] = [];
  for (let n = lo; n <= hi; n++) if (pcs.has(n % 12)) notes.push(n);
  return notes;
}

const nearestIndex = (notes: number[], note: number) =>
  notes.reduce((best, n, i) => (Math.abs(n - note) < Math.abs(notes[best] - note) ? i : best), 0);

// ---------------------------------------------------------------- 旋律

/** 1音: at・len は16分音符で数えた位置と長さ。step は前の音から（使える音の並びで）いくつ動くか */
type MelodyNote = { at: number; len: number; step: number };
type Bar = MelodyNote[];
type Rhythm = [at: number, len: number][];

/** 呼びかけ: 3〜4音。間を残して、ひとりごとのように */
const CALLS: Rhythm[] = [
  [[0, 2], [3, 2], [6, 6]],
  [[2, 2], [4, 2], [6, 3], [10, 6]],
  [[0, 3], [3, 3], [6, 8]],
  [[0, 2], [2, 2], [4, 4], [10, 6]],
  [[4, 2], [6, 2], [8, 8]],
  [[0, 6], [6, 2], [8, 8]],
];
/** 応答: さらに少ない音で */
const ANSWERS: Rhythm[] = [
  [[0, 4], [6, 2], [8, 8]],
  [[0, 2], [2, 2], [4, 12]],
  [[2, 3], [6, 10]],
  [[0, 8], [10, 6]],
];
const ENDINGS: Rhythm[] = [[[0, 16]], [[0, 2], [2, 14]], [[0, 3], [3, 3], [6, 10]]];

/** 次の音への動き: ほとんどが隣の音か一つ飛ばし。跳ぶのはまれ */
function step(rng: Rng, dir: number) {
  const r = rng();
  if (r < 0.14) return 0;
  const size = r < 0.62 ? 1 : r < 0.92 ? 2 : 3;
  return size * (rng() < 0.7 ? dir : -dir);
}

const makeBar = (rng: Rng, rhythm: Rhythm, dir: number): Bar => rhythm.map(([at, len]) => ({ at, len, step: step(rng, dir) }));
const vary = (rng: Rng, bar: Bar, rate: number): Bar => bar.map((n) => (rng() < rate ? { ...n, step: step(rng, Math.sign(n.step) || 1) } : n));

type Hook = { call: Bar; answers: [Bar, Bar, Bar]; ending: Bar };

function makeHook(rng: Rng): Hook {
  const dir = rng() < 0.5 ? 1 : -1;
  return {
    call: makeBar(rng, pickFrom(rng, CALLS), dir),
    answers: [makeBar(rng, pickFrom(rng, ANSWERS), -dir), makeBar(rng, pickFrom(rng, ANSWERS), -dir), makeBar(rng, pickFrom(rng, ANSWERS), dir)],
    ending: makeBar(rng, pickFrom(rng, ENDINGS), -dir),
  };
}

/** 8小節の並び: 呼びかけ → 応答を4回。呼びかけはいつも同じ形で戻り、最後だけ結ぶ */
const hookBars = (h: Hook): Bar[] => [h.call, h.answers[0], h.call, h.answers[1], h.call, h.answers[0], h.call, h.ending];

// ---------------------------------------------------------------- 演奏

type Options = {
  /**
   * どこから流すか。chorus なら B メロの終わり2小節から入り、すぐにサビを聴かせる（動画用）。
   * 数なら、1巡目の何小節目から（0 が前奏の頭）
   */
  from?: "intro" | "chorus" | number;
  /** 書き出し用: この秒数ぶんを最初にまとめて刻み、タイマーを使わない（OfflineAudioContext で描き出すため） */
  duration?: number;
};

export type SongVoice = {
  stop: () => void;
  /** いま鳴っている位置（1巡目の頭からの秒。2巡目以降は間奏の後に A メロの頭へ戻して数える）。まだ始まっていなければ null */
  position: () => number | null;
};

/** 1巡目の小節数（前奏 + A メロ〜間奏） */
const FIRST_PASS_BARS = INTRO_BARS + CYCLE_BARS;
/** B メロの終わり2小節（「サビの手前から」で入る小節） */
const CHORUS_LEAD_BAR = INTRO_BARS + SECTION_BARS + 6;

const SECTION_LABEL: Record<SectionName, string> = {
  intro: "前奏",
  verse: "A メロ",
  pre: "B メロ",
  chorus: "サビ",
  chorus2: "サビ",
  interlude: "間奏",
};

/** 曲の並び（再生バーに段の区切りを描くため）: 1小節の秒数と、1巡目の長さ、段ごとの始まりの小節 */
export function songLayout(key: SongKey) {
  const barSec = 240 / SONGS[key].bpm;
  const sections = (["intro", ...CYCLE] as SectionName[]).map((name, i) => ({
    label: SECTION_LABEL[name],
    from: i === 0 ? 0 : INTRO_BARS + (i - 1) * SECTION_BARS,
    bars: i === 0 ? INTRO_BARS : SECTION_BARS,
  }));
  return { barSec, bars: FIRST_PASS_BARS, seconds: barSec * FIRST_PASS_BARS, sections, chorusLeadBar: CHORUS_LEAD_BAR };
}

/** 先に刻んでおく長さ（秒）と見直す間隔（ms）。別のタブで間引かれても途切れないように */
const LOOKAHEAD_SEC = 6;
const TICK_MS = 1000;
/** こもらせたとき・遠のいたとき・開いたときの、全体のフィルターの高さ（Hz） */
const CLOSED = 1100;
const DISTANT = 2600;
const OPEN = 16000;

/** 曲を out へ流し始める */
export function startSong(ctx: BaseAudioContext, out: AudioNode, key: SongKey, options: Options = {}): SongVoice {
  const song = SONGS[key];
  const sixteenth = 15 / song.bpm;
  const barSec = sixteenth * 16;
  const output = ctx.createGain();
  output.connect(out);
  const mix = createMix(ctx, output, song);
  const penta = (song.minor ? MINOR_PENTA : MAJOR_PENTA).map((n) => (n + song.tonic) % 12);
  const loops = {
    verse: song.verse.map(barChords),
    pre: song.pre.map(barChords),
    chorus: song.chorus.map(barChords),
    interlude: song.interlude.map(barChords),
  };
  const hooks = new Map<number, Hook>();
  const motif = makeHook(seeded(SONGS[MOTIF_SONG].seed)).call;
  const ownHook = makeHook(seeded(song.seed));
  // タイトルと星天の塔の曲は、観測者の主題をそのままサビの呼びかけにする
  const baseHook = key === "title" || key === "zenith" ? { ...ownHook, call: motif } : ownHook;
  // 巡るたびに応答を少しだけ変える（1巡目はそのまま。呼びかけの形は保つ）
  const hookOf = (cycle: number) => {
    let h = hooks.get(cycle);
    if (!h) {
      const rng = seeded(song.seed * 7919 + cycle * 104729);
      h = cycle === 0 ? baseHook : { ...baseHook, answers: baseHook.answers.map((a) => vary(rng, a, 0.35)) as Hook["answers"] };
      hooks.set(cycle, h);
      hooks.delete(cycle - 2);
    }
    return h;
  };

  const place = (bar: number) => {
    if (bar < INTRO_BARS) return { section: "intro" as SectionName, inSection: bar, cycle: 0 };
    const c = bar - INTRO_BARS;
    const inCycle = c % CYCLE_BARS;
    return { section: CYCLE[Math.floor(inCycle / SECTION_BARS)], inSection: inCycle % SECTION_BARS, cycle: Math.floor(c / CYCLE_BARS) };
  };
  const chordsAt = (bar: number) => {
    const { section, inSection } = place(bar);
    const loop = section === "intro" ? loops.interlude : section === "chorus2" ? loops.chorus : loops[section];
    return loop[inSection % 4];
  };

  let bar = typeof options.from === "number" ? Math.max(0, Math.min(FIRST_PASS_BARS - 1, Math.floor(options.from))) : options.from === "chorus" ? CHORUS_LEAD_BAR : 0;
  // 再生位置を測る目印: ある小節を鳴らし始めた時刻（遅れて刻み直したら付け替える）
  let anchor: { time: number; bar: number } | null = null;
  const position = () => {
    if (!anchor) return null;
    let b = anchor.bar + Math.max(0, ctx.currentTime - anchor.time) / barSec;
    if (b >= FIRST_PASS_BARS) b = INTRO_BARS + ((b - INTRO_BARS) % CYCLE_BARS);
    return b * barSec;
  };
  let next = ctx.currentTime + 0.15;
  let rightHand: number[] = [];
  let prevNote = song.center;
  mix.tone.frequency.setValueAtTime(bar === 0 ? CLOSED : OPEN, next);

  const playBar = () => {
    const t = next;
    if (!anchor) anchor = { time: t, bar };
    const { section, inSection, cycle } = place(bar);
    const chorusLike = section === "chorus" || section === "chorus2";
    const chords = chordsAt(bar);
    const swing = (s: number) => (s % 2 === 1 ? song.swing * sixteenth : 0);
    const at16 = (s: number) => t + s * sixteenth + swing(s) + humanize();
    const tone = mix.tone.frequency;

    // ---- 全体の遠さ: 前奏はこもった音から開き、間奏で遠のいて、最後の2小節でまた近づく
    if (section === "intro" && inSection === INTRO_BARS - 1) tone.exponentialRampToValueAtTime(OPEN, t + barSec);
    if (section === "interlude" && inSection === 0) {
      tone.setValueAtTime(OPEN, t);
      tone.exponentialRampToValueAtTime(DISTANT, t + barSec * 2);
    }
    if (section === "interlude" && inSection === 6) {
      tone.setValueAtTime(DISTANT, t);
      tone.exponentialRampToValueAtTime(OPEN, t + barSec * 2);
    }

    // ---- 左手: 低い根音を置いて響かせ、5度か10度を少し遅れて重ねる（間を大きく空けた開いた和音）
    for (const { chord: c, from } of chords) {
      const length = ((chords.find((x) => x.from > from)?.from ?? 16) - from) * sixteenth;
      const root = lowRoot(c);
      const lv = section === "intro" || section === "interlude" ? 0.42 : chorusLike ? 0.55 : 0.48;
      piano(mix, root, at16(from), lv * wobble(), length + 0.4);
      const third = c.pcs.includes((c.root + 4) % 12) ? 4 : c.pcs.includes((c.root + 3) % 12) ? 3 : null;
      const second = third !== null && Math.random() < 0.5 ? root + 12 + third : root + 7;
      piano(mix, second, at16(from + 2), lv * 0.6 * wobble(), length);
    }

    // ---- 右手の和音: 根音を抜いた配置を、そっと崩して置く
    const comp: Rhythm =
      section === "intro" || section === "interlude"
        ? [[4, 12]]
        : chorusLike
          ? [[0, 6], [6, 4], [10, 6]]
          : section === "pre"
            ? [[0, 8], [8, 8]]
            : [[2, 8], [10, 6]];
    for (const [s, len] of comp) {
      const c = chordIn(chords, s);
      rightHand = voiceChord(c.color, rightHand, 60);
      const v = (s % 8 === 0 ? 0.36 : 0.3) * (chorusLike ? 0.85 : 1);
      // 下から上へ、わずかにずらして（ばらして）鳴らす
      rightHand.forEach((note, i) => piano(mix, note, at16(s) + i * 0.022, v * wobble(), len * sixteenth + 0.3));
    }

    // ---- 低い支え（サビだけ）
    if (chorusLike) for (const { chord: c, from } of chords) bass(mix, lowRoot(c) - 12, at16(from), ((chords.find((x) => x.from > from)?.from ?? 16) - from) * sixteenth * 0.95, 0.8);

    // ---- 打楽器（B メロの後半とサビだけ。遠くで、柔らかく）
    const d = song.drums * (chorusLike ? 1 : section === "pre" && inSection >= 4 ? 0.6 : 0);
    if (song.kit && d > 0) {
      const stopAfter = section === "chorus2" && inSection === 7 ? 1 : 16;
      const hit = (sound: DrumSound, s: number, v: number) => {
        if (s < stopAfter) playDrum(mix, sound, at16(s), v * d * wobble());
      };
      if (song.kit === "brush") {
        // 擦る音は鳴らさず（裏で鳴り続けると耳につく）、柔らかいキックと、サビの2・4拍のブラシだけ
        hit("kick", 0, 0.6);
        if (chorusLike) {
          hit("kick", 8, 0.45);
          hit("tap", 4, 0.9);
          hit("tap", 12, 1);
        }
      } else if (song.kit === "lofi") {
        hit("kick", 0, 1);
        hit("kick", 10, 0.8);
        if (chorusLike && inSection % 2 === 1) hit("kick", 7, 0.55);
        if (chorusLike) hit("rim", 4, 0.9);
        hit("rim", 12, chorusLike ? 1 : 0.6);
        for (let s = 0; s < 16; s += 2) hit("hat", s, s % 4 === 2 ? 0.9 : 0.6);
        for (let s = 1; s < 16; s += 2) if (Math.random() < 0.3) hit("hat", s, 0.35);
        if (chorusLike && inSection % 4 === 3) hit("openHat", 14, 0.8);
        if (chorusLike) for (let s = 1; s < 16; s += 2) hit("shaker", s, 0.6);
      } else {
        // 魔導炉: 重いキックと、炉の鼓動のような16分の金物
        hit("kick", 0, 1);
        hit("kick", 7, 0.7);
        hit("kick", 10, 0.9);
        if (chorusLike) {
          hit("tap", 4, 1);
          hit("tap", 12, 1);
          hit("openHat", 6, 0.45);
        }
        for (let s = 0; s < 16; s++) hit("hat", s, s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.8 : 0.4);
      }
    }

    // ---- 星の瞬き: 高い音域で、和音に合う五音音階の音がまばらに鳴る
    const twinkles = song.stars * (chorusLike ? 0.6 : section === "intro" || section === "interlude" ? 1.6 : 1);
    let count = Math.floor(twinkles) + (Math.random() < twinkles % 1 ? 1 : 0);
    while (count-- > 0) {
      const s = Math.floor(Math.random() * 16);
      const c = chordIn(chords, s);
      const sky = melodyNotes(penta, c, 86, 98).filter((n) => c.pcs.includes(n % 12) || penta.includes(n % 12));
      const note = sky[Math.floor(Math.random() * sky.length)];
      piano(mix, note, at16(s), 0.12 + Math.random() * 0.12, undefined, mix.far);
      // ときどき、少し遅れてもう一つ
      if (Math.random() < 0.3) piano(mix, sky[Math.floor(Math.random() * sky.length)], at16(s) + sixteenth * 3, 0.1, undefined, mix.far);
    }

    // ---- 旋律（右手の一本）
    const hook = hookOf(cycle);
    let cell: Bar | null = null;
    let level = 0.62;
    let lift = 0;
    if (chorusLike) cell = hookBars(hook)[inSection];
    else if (section === "pre" && inSection >= 4) {
      // B メロの後半でフックを低く少しだけ聴かせる（サビへの予告）
      cell = inSection % 2 === 0 ? hook.call : null;
      level = 0.42;
      lift = -5;
    } else if (section === "verse" && inSection % 4 === 3) {
      cell = hook.answers[2];
      level = 0.42;
      lift = 2;
    } else if ((section === "interlude" && inSection >= 2 && inSection % 2 === 0 && inSection < 7) || (section === "intro" && inSection % 2 === 1)) {
      // 前奏と間奏では、どの曲でも観測者の主題を遠くで鳴らす
      cell = motif;
      level = section === "intro" ? 0.4 : 0.36;
      lift = 5;
    }
    if (!cell) return;
    const center = song.center + lift + (section === "chorus2" && inSection >= 4 ? 2 : 0);
    const isCall = cell === hook.call || cell === motif;
    cell.forEach((n, i) => {
      const c = chordIn(chords, n.at);
      const notes = melodyNotes(penta, c, center - 6, center + 9);
      let note: number;
      if (i === 0 && (isCall || n.at === 0)) note = notes[nearestIndex(notes, isCall ? center : prevNote)];
      else {
        const from = nearestIndex(notes, prevNote);
        let idx = from + n.step;
        if (idx < 0 || idx >= notes.length) idx = from - n.step;
        note = notes[Math.min(notes.length - 1, Math.max(0, idx))];
      }
      // 結びの最後の音は根音か3度へ
      if (cell === hook.ending && i === cell.length - 1) {
        const rest = notes.filter((x) => [c.root, c.pcs[1]].includes(x % 12));
        if (rest.length) note = rest[nearestIndex(rest, note)];
      }
      prevNote = note;
      const when = at16(n.at);
      const v = level * (n.at % 4 === 0 ? 1 : 0.88) * wobble();
      piano(mix, note, when, v, n.len * sixteenth + 0.6);
      // 2回目のサビの後半は、1オクターブ下を重ねて厚くする
      if (section === "chorus2" && inSection >= 4) piano(mix, note - 12, when + 0.006, v * 0.5, n.len * sixteenth + 0.6);
    });
  };

  const stopAll = () => {
    mix.stop();
    output.disconnect();
  };

  if (options.duration !== undefined) {
    const end = next + options.duration;
    while (next < end) {
      playBar();
      bar += 1;
      next += barSec;
    }
    return { stop: stopAll, position };
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  // 録音したピアノを待ってから始める（読み込めない・遅いときは、5秒で合成のピアノのまま始める）
  let ready = bank !== null;
  void loadPiano(ctx).then(() => (ready = true));
  const giveUp = setTimeout(() => (ready = true), 5000);
  const tick = () => {
    if (stopped) return;
    if (!ready) {
      timer = setTimeout(tick, 200);
      return;
    }
    if (next < ctx.currentTime) {
      next = ctx.currentTime + 0.1;
      if (anchor) anchor = { time: next, bar };
    }
    while (next < ctx.currentTime + LOOKAHEAD_SEC) {
      playBar();
      bar += 1;
      next += barSec;
    }
    timer = setTimeout(tick, TICK_MS);
  };
  tick();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearTimeout(giveUp);
      stopAll();
    },
    position,
  };
}
