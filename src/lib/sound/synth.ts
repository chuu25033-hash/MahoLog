// 音声ファイルが無いときに Web Audio API で組み立てる環境音・効果音。
// 音の軸は詠唱開始音（低くから昇る光と、ゆっくり開く和音）。すべて低音〜中音域に寄せ、柔らかい残響で包む。
// 環境音（BGM）はノイズを使わず、柔らかいピアノとオルゴールで作る。
// タイトルはゆったりした和音の曲、各地は勉強中に眠くならないよう脈と旋律のある曲（stageSong）にし、地ごとに調と進行を変える。
import type { AmbienceKey, SeKey } from "./sound-files";

export type Voice = {
  /** 声部全体の音量（クロスフェードに使う） */
  output: GainNode;
  stop: () => void;
};

const SILENT = 0.0001;

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Layer = { sources: AudioScheduledSourceNode[]; timers: ReturnType<typeof setTimeout>[] };

/** 残響の素: 減衰していくノイズを、時間とともに暗くなるよう均して作る */
function impulseResponse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      // 後ろへ行くほど均しを強め、残響の高域を早く消す
      const k = 0.5 - progress * 0.42;
      smooth += k * (Math.random() * 2 - 1 - smooth);
      data[i] = smooth * Math.pow(1 - progress, 3);
    }
  }
  return buffer;
}

/** 素の音と残響を混ぜて out へ流す入口を作る */
function reverbSend(ctx: AudioContext, out: AudioNode, o: { seconds: number; wet: number; cutoff: number }) {
  const input = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx, o.seconds);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = o.cutoff;
  const wet = ctx.createGain();
  wet.gain.value = o.wet;
  input.connect(out);
  input.connect(reverb).connect(tone).connect(wet).connect(out);
  return input;
}

/** 柔らかいピアノ: 弱めの打鍵でふくらみ、高い倍音から先に消えていく。sustain で余韻の長さを縮める（分散和音を濁らせない） */
function piano(ctx: AudioContext, out: AudioNode, freq: number, at: number, level: number, sustain = 1) {
  const partials: [ratio: number, amp: number, decay: number][] = [
    [1, 1, 4.5 * sustain],
    [2.003, 0.35, 2.4 * sustain],
    [3.008, 0.12, 1.4 * sustain],
    [4.015, 0.05, 0.9 * sustain],
  ];
  for (const [ratio, amp, decay] of partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * amp, at + 0.045);
    gain.gain.exponentialRampToValueAtTime(SILENT, at + decay);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** オルゴール: 短く澄んだ櫛歯の音。わずかにずれた倍音で金属らしい儚さを出す */
function musicBox(ctx: AudioContext, out: AudioNode, freq: number, at: number, level: number) {
  const partials: [ratio: number, amp: number, decay: number][] = [
    [1, 1, 2.4],
    [1.003, 0.4, 2.2],
    [4.1, 0.08, 0.5],
  ];
  for (const [ratio, amp, decay] of partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * amp, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(SILENT, at + decay);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** タイトルの曲の和音（MIDI 番号）と、オルゴールが拾う旋律の候補 */
type Chord = { bass: number; chord: number[]; melody: number[] };

type Piece = {
  /** 繰り返す和音進行 */
  chords: Chord[];
  /** 1つの和音を鳴らす長さ（秒） */
  barSec: number;
  /** ピアノの強さ（タイトルを 1 とする） */
  piano: number;
  /** オルゴールの強さ */
  box: number;
  /** 1小節で鳴らすオルゴールの音数 [最少, 最多] */
  boxNotes: [number, number];
  /** 小節の後半にも和音をそっと置くか */
  afterBeat: boolean;
  /** オルゴールを旋律の候補から何オクターブ上で鳴らすか */
  boxOctave: number;
  /** オルゴールの高域を丸める周波数（Hz） */
  boxCutoff: number;
};

/** 小節内でオルゴールが鳴りうる位置（拍） */
const BOX_SLOTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];

/** ピアノの分散和音に、オルゴールの旋律を毎回少しずつ変えて重ね、繰り返す */
function pianoPiece(ctx: AudioContext, out: AudioNode, layer: Layer, piece: Piece) {
  const send = reverbSend(ctx, out, { seconds: 3.5, wet: 0.55, cutoff: 2200 });
  // フェルトをかけたように、ピアノの高域を丸める
  const pianoTone = ctx.createBiquadFilter();
  pianoTone.type = "lowpass";
  pianoTone.frequency.value = 1600;
  pianoTone.connect(send);
  const boxTone = ctx.createBiquadFilter();
  boxTone.type = "lowpass";
  boxTone.frequency.value = piece.boxCutoff;
  boxTone.connect(send);

  const beat = piece.barSec / 4;
  let bar = 0;
  let next = ctx.currentTime + 0.3;
  const playBar = () => {
    const { bass, chord, melody } = piece.chords[bar % piece.chords.length];
    const t = next;
    piano(ctx, pianoTone, midi(bass), t, 0.11 * piece.piano);
    chord.forEach((note, i) => piano(ctx, pianoTone, midi(note), t + 0.22 * (i + 1), 0.06 * piece.piano));
    if (piece.afterBeat) {
      piano(ctx, pianoTone, midi(chord[0]), t + beat * 2, 0.035 * piece.piano);
      piano(ctx, pianoTone, midi(chord[2]), t + beat * 2 + 0.2, 0.03 * piece.piano);
    }
    // オルゴールは旋律の候補を piece.boxOctave だけ上げて、数音だけ
    const [min, max] = piece.boxNotes;
    const count = min + Math.round(Math.random() * (max - min));
    const slots = [...BOX_SLOTS].sort(() => Math.random() - 0.5).slice(0, count);
    slots.forEach((slot) => {
      const note = melody[Math.floor(Math.random() * melody.length)] + 12 * piece.boxOctave;
      musicBox(ctx, boxTone, midi(note), t + slot * beat, piece.box);
    });
    bar += 1;
    next += piece.barSec;
  };
  // 別のタブを見ている間はタイマーが1秒以上に間引かれるので、数秒先までの小節を先に刻んでおく。
  // 端末の休止などで大きく遅れたら、遅れた小節をまとめて鳴らさず、いまから刻み直す
  const tick = () => {
    if (next < ctx.currentTime) next = ctx.currentTime + 0.1;
    while (next < ctx.currentTime + LOOKAHEAD_SEC) playBar();
    later(layer, tick, TICK_MS);
  };
  tick();
}

/** 環境音の小節を先に刻んでおく長さ（秒）と、見直す間隔（ms） */
const LOOKAHEAD_SEC = 6;
const TICK_MS = 1000;

/** layer に紐づけた setTimeout。鳴り終えた分は一覧から外し、長く流しても溜まらないようにする */
function later(layer: Layer, fn: () => void, ms: number) {
  const id = setTimeout(() => {
    const i = layer.timers.indexOf(id);
    if (i >= 0) layer.timers.splice(i, 1);
    fn();
  }, ms);
  layer.timers.push(id);
}

/** タイトルの曲: ゆっくり下りていく Fmaj7 → Em7 → Dm7 → Cmaj7 */
const TITLE_PIECE: Piece = {
  chords: [
    { bass: 41, chord: [57, 60, 64], melody: [69, 72, 76, 77] },
    { bass: 40, chord: [55, 59, 62], melody: [67, 71, 74, 76] },
    { bass: 38, chord: [57, 60, 65], melody: [65, 69, 72, 74] },
    { bass: 36, chord: [55, 59, 64], melody: [64, 67, 71, 72] },
  ],
  barSec: 4.8,
  piano: 1,
  box: 0.035,
  boxNotes: [3, 4],
  afterBeat: true,
  boxOctave: 1,
  boxCutoff: 3200,
};

// ---- 各地の曲: 勉強のあいだ聴き続けても眠くならないように作る ----
// 前の作りは1拍1.4秒（約43 BPM）で、小節の頭に和音を一度鳴らすと、あとはオルゴールが乱数で1〜2音鳴るだけだった。
// 安静時の心拍より遅く、拍が感じられず、旋律に形が無いので耳が追うものを失い、子守歌と同じ効き方をしていた。
// そこで:
//  - 速さを 74〜88 BPM にし、ピアノの8分の分散和音で途切れない脈を通す（拍の頭を強く、裏を弱く）
//  - 低音は1・3拍目に置き、ときどき次の和音へ経過音で歩み寄って、前へ進む感じを出す
//  - 旋律は2小節の動機を作り、和音に合わせて繰り返し・変奏する（耳が追え、先を予想でき、少しだけ裏切られる）
//  - 8小節の段 A → A′ → B → A′ → 間奏 を巡り、一巡ごとに動機を作り直す（25分聴いても同じ繰り返しにならない）
//  - 段の頭に高い鐘を一つ置き、区切りで意識を軽く引き戻す
//  - 下りきって落ち着く進行をやめ、IV → V → iii → vi のように先へ進む進行にする
//  - 高域を丸めすぎず、残響を浅くして輪郭を出す

/** 和音: root は根音のピッチクラス（0 = C）、tones は根音からの半音数 */
type StageChord = { root: number; tones: number[] };
const C = (root: number, tones: number[]): StageChord => ({ root, tones });
const MAJ7 = [0, 4, 7, 11];
const MIN7 = [0, 3, 7, 10];
const ADD9 = [0, 2, 4, 7];
const MADD9 = [0, 2, 3, 7];
const TRIAD = [0, 4, 7];
const SUS4 = [0, 5, 7];
const SUS7 = [0, 5, 7, 10];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const scaleOf = (tonic: number, mode: number[]) => mode.map((n) => (n + tonic) % 12);

type Song = {
  bpm: number;
  /** 調の音階（ピッチクラス） */
  scale: number[];
  /** 段 A・A′・間奏の進行と、段 B の進行（1小節に1和音） */
  a: StageChord[];
  b: StageChord[];
  /** 8分の分散和音の並び（和音の構成音を低い方から数えた番号） */
  pattern: number[];
  /** 旋律の中心の高さ（MIDI） */
  center: number;
};

const SONGS: Record<Exclude<AmbienceKey, "title">, Song> = {
  // 旅立ちの前（星天の導き）: C の明るい進行。C(add9) → G → Am7 → Fmaj7 / Fmaj7 → G → Em7 → Am7
  prelude: {
    bpm: 84,
    scale: scaleOf(0, MAJOR),
    a: [C(0, ADD9), C(7, TRIAD), C(9, MIN7), C(5, MAJ7)],
    b: [C(5, MAJ7), C(7, TRIAD), C(4, MIN7), C(9, MIN7)],
    pattern: [0, 1, 2, 3, 1, 2, 3, 2],
    center: 76,
  },
  // 小屋: G の温かな進行。Gmaj7 → Em7 → Cmaj7 → D / Cmaj7 → D → Bm7 → Em7
  hearth: {
    bpm: 78,
    scale: scaleOf(7, MAJOR),
    a: [C(7, MAJ7), C(4, MIN7), C(0, MAJ7), C(2, TRIAD)],
    b: [C(0, MAJ7), C(2, TRIAD), C(11, MIN7), C(4, MIN7)],
    pattern: [0, 2, 1, 2, 3, 2, 1, 2],
    center: 74,
  },
  // 樹海・図書室: D ドリアの深い響き。Dm(add9) → Fmaj7 → C(add9) → G / B♭maj7 → C → Dm7 → Am7
  forest: {
    bpm: 76,
    scale: scaleOf(2, DORIAN),
    a: [C(2, MADD9), C(5, MAJ7), C(0, ADD9), C(7, TRIAD)],
    b: [C(10, MAJ7), C(0, TRIAD), C(2, MIN7), C(9, MIN7)],
    pattern: [0, 2, 1, 3, 0, 2, 1, 3],
    center: 74,
  },
  // 観測塔・星空: E の澄んだ王道進行。Amaj7 → B → G♯m7 → C♯m7 / F♯m7 → B7sus4 → Emaj7 → C♯m7
  stars: {
    bpm: 82,
    scale: scaleOf(4, MAJOR),
    a: [C(9, MAJ7), C(11, TRIAD), C(8, MIN7), C(1, MIN7)],
    b: [C(6, MIN7), C(11, SUS7), C(4, MAJ7), C(1, MIN7)],
    pattern: [0, 1, 3, 2, 1, 3, 2, 3],
    center: 78,
  },
  // 氷の回廊: B マイナーの張りつめた静けさ。Bm(add9) → Gmaj7 → D(add9) → A / Em7 → F♯m7 → Gmaj7 → Asus4
  frost: {
    bpm: 80,
    scale: scaleOf(11, MINOR),
    a: [C(11, MADD9), C(7, MAJ7), C(2, ADD9), C(9, TRIAD)],
    b: [C(4, MIN7), C(6, MIN7), C(7, MAJ7), C(9, SUS4)],
    pattern: [0, 2, 1, 2, 0, 2, 1, 2],
    center: 76,
  },
  // 魔導炉: E マイナーの推進力。Em7 → Cmaj7 → D → Bm7 / Am7 → Bm7 → Cmaj7 → D(add9)
  forge: {
    bpm: 88,
    scale: scaleOf(4, MINOR),
    a: [C(4, MIN7), C(0, MAJ7), C(2, TRIAD), C(11, MIN7)],
    b: [C(9, MIN7), C(11, MIN7), C(0, MAJ7), C(2, ADD9)],
    pattern: [0, 1, 2, 1, 3, 1, 2, 1],
    center: 72,
  },
  // 大聖堂: F の荘厳な王道進行。B♭maj7 → C → Am7 → Dm7 / Gm7 → Csus4 → Fmaj7 → Dm7
  sanctum: {
    bpm: 74,
    scale: scaleOf(5, MAJOR),
    a: [C(10, MAJ7), C(0, TRIAD), C(9, MIN7), C(2, MIN7)],
    b: [C(7, MIN7), C(0, SUS4), C(5, MAJ7), C(2, MIN7)],
    pattern: [0, 2, 3, 2, 1, 2, 3, 2],
    center: 74,
  },
};

const pcsOf = (c: StageChord) => c.tones.map((t) => (c.root + t) % 12);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** 和音の上で旋律に使う音（MIDI 昇順）: 和音の音の半音上にぶつかる音を外し、和音の音を足す */
function melodyNotes(scale: number[], chord: number[], lo: number, hi: number) {
  const pcs = new Set(chord);
  for (const pc of scale) if (!chord.some((c) => (pc - c + 12) % 12 === 1)) pcs.add(pc);
  const notes: number[] = [];
  for (let n = lo; n <= hi; n++) if (pcs.has(n % 12)) notes.push(n);
  return notes;
}

/** note にいちばん近い、pcs のどれかの音 */
function nearestOf(note: number, pcs: number[]) {
  for (let d = 0; d < 12; d++) {
    if (pcs.includes((note + d) % 12)) return note + d;
    if (pcs.includes((note - d + 12) % 12)) return note - d;
  }
  return note;
}

const nearestIndex = (notes: number[], note: number) =>
  notes.reduce((best, n, i) => (Math.abs(n - note) < Math.abs(notes[best] - note) ? i : best), 0);

/** 分散和音の並び: 前の和音から指の動きが少なく、中音域に収まる転回形を選ぶ */
function voiceChord(pcs: number[], prev: number[]) {
  const mean = (v: number[]) => v.reduce((s, n) => s + n, 0) / v.length;
  const prevMean = prev.length ? mean(prev) : 62;
  let best: number[] = [];
  let bestScore = Infinity;
  for (const lowPc of pcs) {
    const low = 55 + ((lowPc - 55 + 120) % 12);
    const voicing = pcs.map((pc) => low + ((pc - lowPc + 12) % 12)).sort((x, y) => x - y);
    const score = Math.abs(mean(voicing) - prevMean) + 0.25 * Math.abs(mean(voicing) - 62);
    if (score < bestScore) [best, bestScore] = [voicing, score];
  }
  return best;
}

/** 旋律の1音: at・len は8分音符で数えた位置と長さ、step は前の音から音階でいくつ動くか */
type MelodyNote = { at: number; len: number; step: number };
/** 4小節の楽句の形: 提示 → 応答 → 提示の変奏 → 結び */
type Motif = { dir: 1 | -1; open: MelodyNote[]; answer: MelodyNote[]; again: MelodyNote[]; close: MelodyNote[] };

const OPEN_RHYTHMS: [number, number][][] = [
  [[0, 2], [2, 1], [3, 1], [4, 4]],
  [[0, 3], [3, 1], [4, 2], [6, 2]],
  [[0, 2], [2, 2], [4, 2], [6, 1], [7, 1]],
  [[1, 1], [2, 2], [4, 3], [7, 1]],
  [[0, 1], [1, 1], [2, 2], [4, 4]],
  [[0, 4], [4, 1], [5, 1], [6, 2]],
];
const ANSWER_RHYTHMS: [number, number][][] = [
  [[0, 2], [2, 2], [4, 4]],
  [[0, 3], [3, 1], [4, 4]],
  [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2]],
  [[0, 6], [6, 1], [7, 1]],
];
const CLOSE_RHYTHMS: [number, number][][] = [[[0, 8]], [[0, 2], [2, 6]], [[0, 3], [3, 5]], [[0, 1], [1, 1], [2, 6]]];

/** 次の音への動き: 多くは順次進行で、ときどき跳ぶ。dir の向きへ寄せて、旋律に山を作る */
function stepToward(dir: 1 | -1) {
  if (Math.random() < 0.15) return 0;
  const r = Math.random();
  const size = r < 0.65 ? 1 : r < 0.9 ? 2 : 3;
  return size * (Math.random() < 0.7 ? dir : -dir);
}

const notesOf = (rhythm: [number, number][], dir: 1 | -1): MelodyNote[] =>
  rhythm.map(([at, len]) => ({ at, len, step: stepToward(dir) }));

const mutate = (notes: MelodyNote[], rate: number, dir: 1 | -1) =>
  notes.map((n) => (Math.random() < rate ? { ...n, step: stepToward(dir) } : n));

function makeMotif(): Motif {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const back = dir === 1 ? -1 : 1;
  const open = notesOf(pick(OPEN_RHYTHMS), dir);
  return {
    dir,
    open,
    answer: notesOf(pick(ANSWER_RHYTHMS), back),
    again: mutate(open, 0.4, dir),
    close: notesOf(pick(CLOSE_RHYTHMS), back),
  };
}

/** 動機の変奏: 音の動きを rate の割合で選び直す。リズムは保つので、同じ動機だと聴き取れる */
const varyMotif = (m: Motif, rate: number): Motif => ({
  ...m,
  open: mutate(m.open, rate, m.dir),
  answer: mutate(m.answer, rate, m.dir === 1 ? -1 : 1),
  again: mutate(m.again, rate, m.dir),
});

/** 段の2つの楽句: 2つ目は少しだけ変え、結びのリズムも替える */
const phrasePair = (m: Motif): [Motif, Motif] => [
  m,
  { ...varyMotif(m, 0.2), close: notesOf(pick(CLOSE_RHYTHMS), m.dir === 1 ? -1 : 1) },
];

/** 曲の入りの、旋律を乗せない小節数 */
const INTRO_BARS = 4;
/** 段の長さ（小節）と、一巡する段の並び */
const SECTION_BARS = 8;
const SECTIONS = ["a", "a2", "b", "a2", "interlude"] as const;
const CYCLE_BARS = SECTION_BARS * SECTIONS.length;
type Section = (typeof SECTIONS)[number] | "intro";
/** 段ごとの強さ */
const SECTION_LEVEL: Record<Section, number> = { intro: 0.85, a: 1, a2: 1, b: 1.08, interlude: 0.92 };
/** 楽句の中の強弱: 3小節目へ向かってふくらみ、結びで少し引く */
const PHRASE_SWELL = [0.92, 1, 1.06, 0.96];

/** わずかな揺らぎ: 機械的に揃いすぎた音は聴き流され、眠気を誘う */
const humanize = () => (Math.random() - 0.5) * 0.014;
const velocity = () => 0.88 + Math.random() * 0.24;

function stageSong(ctx: AudioContext, out: AudioNode, layer: Layer, song: Song) {
  const send = reverbSend(ctx, out, { seconds: 2.8, wet: 0.38, cutoff: 2800 });
  const pianoTone = ctx.createBiquadFilter();
  pianoTone.type = "lowpass";
  pianoTone.frequency.value = 2600;
  pianoTone.connect(send);
  const boxTone = ctx.createBiquadFilter();
  boxTone.type = "lowpass";
  boxTone.frequency.value = 4200;
  boxTone.connect(send);

  const eighth = 30 / song.bpm;
  const barSec = eighth * 8;
  const sectionAt = (b: number): Section => (b < 0 ? "intro" : SECTIONS[Math.floor((b % CYCLE_BARS) / SECTION_BARS)]);
  const chordAt = (b: number) => (sectionAt(b) === "b" ? song.b : song.a)[((b % 4) + 4) % 4];
  const bassOf = (c: StageChord) => 40 + ((c.root - 4 + 12) % 12);
  const newMotifs = () => {
    const a = makeMotif();
    return { a: phrasePair(a), a2: phrasePair(varyMotif(a, 0.3)), b: phrasePair(makeMotif()) };
  };

  let bar = -INTRO_BARS;
  let next = ctx.currentTime + 0.3;
  let voicing: number[] = [];
  let prevNote = song.center;
  let motifs = newMotifs();

  const playBar = () => {
    const t = next;
    const section = sectionAt(bar);
    const inSection = bar < 0 ? bar + INTRO_BARS : bar % SECTION_BARS;
    const inPhrase = inSection % 4;
    const level = SECTION_LEVEL[section] * PHRASE_SWELL[inPhrase];
    const chord = chordAt(bar);
    const pcs = pcsOf(chord);
    voicing = voiceChord(pcs, voicing);
    // 一巡したら動機を作り直す
    if (bar > 0 && bar % CYCLE_BARS === 0) motifs = newMotifs();

    // 低音: 1拍目に根音、3拍目に五度。ときどき4拍目の裏で次の根音へ歩み寄る
    const bass = bassOf(chord);
    piano(ctx, pianoTone, midi(bass), t + humanize(), 0.08 * level * velocity());
    piano(ctx, pianoTone, midi(bass + 7), t + eighth * 4 + humanize(), 0.04 * level * velocity(), 0.6);
    if (section !== "intro" && Math.random() < 0.35) {
      const target = bassOf(chordAt(bar + 1));
      const approach = target + (target > bass ? -2 : 2);
      piano(ctx, pianoTone, midi(approach), t + eighth * 7 + humanize(), 0.03 * level * velocity(), 0.4);
    }

    // 8分の分散和音（曲の入りは4分だけにして、少しずつ動き出す）
    song.pattern.forEach((index, i) => {
      if (section === "intro" && i % 2 === 1) return;
      const accent = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.75 : 0.55;
      const note = voicing[index % voicing.length];
      piano(ctx, pianoTone, midi(note), t + eighth * i + humanize(), 0.03 * accent * level * velocity(), 0.5);
    });

    // 段の頭の鐘。間奏では旋律の代わりに、高い鐘をまばらに置く
    const bell = (at: number, height: number) =>
      musicBox(ctx, boxTone, midi(nearestOf(song.center + height, pcs)), t + at + humanize(), 0.022 * level);
    if (inSection === 0 && section !== "intro") bell(0, 12);
    if (section === "interlude" && inSection % 2 === 0) bell(eighth * 3, 7 + Math.floor(Math.random() * 6));

    // 旋律（オルゴール）
    if (section === "intro" || section === "interlude") return;
    const motif = motifs[section][inSection < 4 ? 0 : 1];
    const cell = [motif.open, motif.answer, motif.again, motif.close][inPhrase];
    const center = song.center + (section === "b" ? 5 : 0);
    const notes = melodyNotes(song.scale, pcs, center - 7, center + 10);
    // 2つ目の楽句の結びは根音で閉じ、1つ目は和音の別の音で開いたまま次へ渡す
    const resolveTo = inSection >= 4 ? [chord.root] : pcs;
    cell.forEach((n, i) => {
      let note: number;
      if (inPhrase === 0 && i === 0) note = nearestOf(center, pcs);
      else {
        const from = nearestIndex(notes, prevNote);
        let idx = from + n.step;
        if (idx < 0 || idx >= notes.length) idx = from - n.step;
        note = notes[Math.min(notes.length - 1, Math.max(0, idx))];
        // 結びの音は resolveTo へ、強拍や長い音は和音の音へ寄せる
        if (inPhrase === 3 && i === cell.length - 1) note = nearestOf(note, resolveTo);
        else if (n.at % 4 === 0 || n.len >= 3) note = nearestOf(note, pcs);
        // 動くはずの音が寄せた結果で前の音に戻ったら、動く向きにある次の和音の音へ進める
        if (n.step !== 0 && note === prevNote) {
          const dir = Math.sign(n.step);
          for (let d = 1; d <= 5; d++) if (pcs.includes((note + dir * d + 12) % 12)) {
            note += dir * d;
            break;
          }
        }
      }
      prevNote = note;
      musicBox(ctx, boxTone, midi(note), t + eighth * n.at + humanize(), 0.034 * level * velocity());
    });
  };

  // 別のタブを見ている間はタイマーが間引かれるので、数秒先までの小節を先に刻んでおく（pianoPiece と同じ）
  const tick = () => {
    if (next < ctx.currentTime) next = ctx.currentTime + 0.1;
    while (next < ctx.currentTime + LOOKAHEAD_SEC) {
      playBar();
      bar += 1;
      next += barSec;
    }
    later(layer, tick, TICK_MS);
  };
  tick();
}

function soundscape(ctx: AudioContext, out: AudioNode, layer: Layer, key: Exclude<AmbienceKey, "title">) {
  stageSong(ctx, out, layer, SONGS[key]);
}

// ---- 遠くの森から届くフクロウの声（モリフクロウ風） ----
// 夜の外気を感じる地（タイトル・小屋・樹海・観測塔）の環境音に、ときどき遠くから混ぜる

/** 減衰していくノイズで作る、夜の森の残響 */
export function forestReverb(ctx: AudioContext, destination: AudioNode) {
  const seconds = 3.2;
  const buffer = ctx.createBuffer(2, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2.6;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = buffer;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 1400;
  convolver.connect(tone).connect(destination);
  return convolver;
}

/**
 * フクロウのひと声: 少し下がっていく丸い声と、かすかな息。tremolo を付けると震える長い声になる
 */
function hoot(ctx: AudioContext, out: AudioNode, at: number, o: { freq: number; length: number; level: number; tremolo?: boolean }) {
  const end = at + o.length;
  const voice = ctx.createGain();
  voice.gain.setValueAtTime(0.0001, at);
  voice.gain.exponentialRampToValueAtTime(o.level, at + Math.min(0.07, o.length * 0.3));
  voice.gain.setValueAtTime(o.level, Math.max(at + 0.07, end - 0.16));
  voice.gain.exponentialRampToValueAtTime(0.0001, end);
  voice.connect(out);

  // 声の芯（わずかに倍音を混ぜて、木の洞に響くような丸みを出す）
  [
    [1, 1],
    [2, 0.07],
  ].forEach(([mult, gain]) => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(o.freq * mult * 1.03, at);
    osc.frequency.exponentialRampToValueAtTime(o.freq * mult * 0.9, end);
    const level = ctx.createGain();
    level.gain.value = gain;
    osc.connect(level).connect(voice);
    if (o.tremolo) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9;
      const depth = ctx.createGain();
      depth.gain.value = o.freq * mult * 0.025;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(end);
    }
    osc.start(at);
    osc.stop(end + 0.05);
  });

  // 息の音
  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * o.length), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const breath = ctx.createBufferSource();
  breath.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = o.freq * 1.4;
  band.Q.value = 2.5;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.18;
  breath.connect(band).connect(breathLevel).connect(voice);
  breath.start(at);
}

/** 「ホーー」……「ホッ、ホ、ホーーォ」。dry に素の声、wet（forestReverb）に残響へ送る声を流す。distance は 0〜1（1 がいちばん遠く小さい） */
export function owlCall(ctx: AudioContext, dry: AudioNode, wet: AudioNode, at: number, distance: number) {
  const out = ctx.createGain();
  const level = 0.1 * (1 - distance * 0.6);
  // 遠いほど高い音が削れ、残響に埋もれる
  const air = ctx.createBiquadFilter();
  air.type = "lowpass";
  air.frequency.value = 1800 - distance * 900;
  out.connect(air);
  const direct = ctx.createGain();
  direct.gain.value = 0.55 - distance * 0.35;
  air.connect(direct).connect(dry);
  const send = ctx.createGain();
  send.gain.value = 0.6 + distance * 0.4;
  air.connect(send).connect(wet);

  const f = 430;
  hoot(ctx, out, at, { freq: f, length: 0.85, level });
  hoot(ctx, out, at + 2.1, { freq: f * 1.04, length: 0.16, level: level * 0.7 });
  hoot(ctx, out, at + 2.45, { freq: f, length: 0.22, level: level * 0.8 });
  hoot(ctx, out, at + 2.85, { freq: f * 1.02, length: 1.2, level, tremolo: true });
}

/** フクロウが鳴く地 */
const OWL_AMBIENCES = new Set<AmbienceKey>(["title", "hearth", "forest", "stars"]);

/** 曲が流れ始めて 30 秒前後で最初の一声、その後は 1 分半〜3 分に一度。遠さもその都度変える */
function owlNights(ctx: AudioContext, out: AudioNode, layer: Layer) {
  const reverb = forestReverb(ctx, out);
  const next = (delayMs: number) =>
    later(
      layer,
      () => {
        owlCall(ctx, out, reverb, ctx.currentTime + 0.1, 0.3 + Math.random() * 0.5);
        next(90_000 + Math.random() * 90_000);
      },
      delayMs,
    );
  next(20_000 + Math.random() * 20_000);
}

/** 生成した環境音の声部（音量 0 から始まる） */
export function synthAmbience(ctx: AudioContext, key: AmbienceKey, destination: AudioNode): Voice {
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(destination);
  const layer: Layer = { sources: [], timers: [] };
  if (key === "title") pianoPiece(ctx, output, layer, TITLE_PIECE);
  else soundscape(ctx, output, layer, key);
  if (OWL_AMBIENCES.has(key)) owlNights(ctx, output, layer);
  return {
    output,
    stop: () => {
      layer.timers.forEach(clearTimeout);
      layer.timers.length = 0;
      layer.sources.forEach((s) => {
        try {
          s.stop();
        } catch {}
      });
      output.disconnect();
    },
  };
}

type ToneOptions = {
  freq: number;
  /** 指定すると、鳴り始めからこの周波数へ滑らせる */
  toFreq?: number;
  at?: number;
  attack?: number;
  decay: number;
  peak: number;
  type?: OscillatorType;
};

/** 効果音の音程を全体に下げる倍率（各音の周波数・ノイズの帯域にかける）。重く静かな響きにする */
const SE_PITCH = 0.76;

function tone(ctx: AudioContext, out: AudioNode, o: ToneOptions) {
  const t = ctx.currentTime + (o.at ?? 0);
  const attack = o.attack ?? 0.005;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq * SE_PITCH, t);
  if (o.toFreq) osc.frequency.exponentialRampToValueAtTime(o.toFreq * SE_PITCH, t + attack + o.decay * 0.6);
  const gain = ctx.createGain();
  // 立ち上がりは直線で、鳴り始めから素直にふくらませる（指数だと終わり際に急に大きくなる）
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(o.peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + attack + o.decay);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + attack + o.decay + 0.05);
}

let whiteNoise: { ctx: BaseAudioContext; buffer: AudioBuffer } | null = null;

/** 2秒の白色ノイズ（文脈ごとに一度だけ作って使い回す） */
function noiseBuffer(ctx: AudioContext) {
  if (whiteNoise?.ctx !== ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    whiteNoise = { ctx, buffer };
  }
  return whiteNoise.buffer;
}

/** 帯域を滑らせるノイズ（魔力が渦を巻く気配） */
function whoosh(ctx: AudioContext, out: AudioNode, o: { from: number; to: number; duration: number; peak: number }) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(o.from * SE_PITCH, t);
  filter.frequency.exponentialRampToValueAtTime(o.to * SE_PITCH, t + o.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.exponentialRampToValueAtTime(o.peak, t + o.duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + o.duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random() * 0.5, o.duration + 0.05);
}

/**
 * 古い羊皮紙がほどける音: ごく短いノイズの粒を、乾いた中高域で不規則に散らす。
 * 始めほど粒が詰まり、終わりに向けてまばらになって消える
 */
function parchment(ctx: AudioContext, out: AudioNode, o: { at: number; duration: number; peak: number }) {
  const buffer = noiseBuffer(ctx);
  const grains = 18;
  for (let i = 0; i < grains; i++) {
    const progress = i / grains;
    const t = ctx.currentTime + o.at + o.duration * progress ** 1.6 + Math.random() * 0.03;
    const length = 0.025 + Math.random() * 0.06;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = (1400 + Math.random() * 1600) * SE_PITCH;
    band.Q.value = 0.9;
    const gain = ctx.createGain();
    const peak = o.peak * (1 - progress * 0.7) * (0.5 + Math.random() * 0.5);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(SILENT, t + length);
    src.connect(band).connect(gain).connect(out);
    src.start(t, Math.random() * 1.5, length + 0.02);
  }
}

/**
 * 星屑のきらめき: 高く澄んだ粒を五音から拾って次々に鳴らす。
 * falling なら高い音から低い音へ零れ落ち、そうでなければ低い音から舞い上がる
 */
function sparkle(ctx: AudioContext, out: AudioNode, o: { at: number; count: number; span: number; peak: number; falling: boolean }) {
  const notes = [784, 880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3];
  for (let i = 0; i < o.count; i++) {
    const progress = i / Math.max(1, o.count - 1);
    const height = o.falling ? 1 - progress : progress;
    const index = Math.min(notes.length - 1, Math.max(0, Math.round(height * (notes.length - 1) + (Math.random() * 2 - 1) * 1.2)));
    const at = o.at + o.span * progress + Math.random() * 0.05;
    const peak = o.peak * (0.55 + Math.random() * 0.45) * (o.falling ? 1 - progress * 0.5 : 0.6 + progress * 0.4);
    tone(ctx, out, { freq: notes[index], at, attack: 0.004, decay: 0.5 + Math.random() * 0.5, peak });
    tone(ctx, out, { freq: notes[index] * 2.76, at, attack: 0.004, decay: 0.15, peak: peak * 0.12 });
  }
}

// 効果音の周波数は SE_PITCH をかける前の値。詠唱開始音（196〜880Hz）の音域にそろえている
const SE: Record<SeKey, (ctx: AudioContext, out: AudioNode) => void> = {
  // 旅立ち: 低くふくらむ光と、ゆっくり開く和音
  begin: (ctx, out) => {
    tone(ctx, out, { freq: 146.8, toFreq: 293.7, attack: 0.3, decay: 2, peak: 0.09 });
    whoosh(ctx, out, { from: 200, to: 900, duration: 1.2, peak: 0.03 });
    [293.7, 440, 587.3].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 0.25 + i * 0.12, attack: 0.2, decay: 2.2, peak: 0.045 });
    });
    tone(ctx, out, { freq: 880, at: 0.7, attack: 0.05, decay: 1.8, peak: 0.02 });
  },
  // タップ: 澄んだ水晶が静かに鳴る短音。わずかに遅れて1オクターブ上が瞬き、星がきらめくような余韻を残す
  tap: (ctx, out) => {
    tone(ctx, out, { freq: 880, attack: 0.006, decay: 0.5, peak: 0.055 });
    tone(ctx, out, { freq: 440, attack: 0.006, decay: 0.2, peak: 0.015 });
    tone(ctx, out, { freq: 880 * 2.76, attack: 0.006, decay: 0.2, peak: 0.007 });
    tone(ctx, out, { freq: 1760, at: 0.04, attack: 0.02, decay: 0.7, peak: 0.012 });
  },
  // 静かな魔法陣起動音: 低くから昇る光と、ゆっくり開く和音（全体のトーンの基準）
  chantStart: (ctx, out) => {
    tone(ctx, out, { freq: 196, toFreq: 440, attack: 0.45, decay: 1.8, peak: 0.1 });
    whoosh(ctx, out, { from: 250, to: 1100, duration: 1.4, peak: 0.035 });
    tone(ctx, out, { freq: 440, at: 0.7, attack: 0.15, decay: 1.8, peak: 0.05 });
    tone(ctx, out, { freq: 659.25, at: 0.8, attack: 0.15, decay: 2, peak: 0.035 });
    tone(ctx, out, { freq: 880, at: 0.9, attack: 0.12, decay: 1.6, peak: 0.015 });
  },
  // 神聖な魔力集束チャイム: 低い礎の音の上に、控えめな和音がふわりと立ち上がって長く残る
  chantComplete: (ctx, out) => {
    tone(ctx, out, { freq: 196, attack: 0.3, decay: 3, peak: 0.045 });
    [392, 493.9, 587.3, 784, 987.8].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.14, attack: 0.15, decay: 2.6, peak: 0.055 });
      tone(ctx, out, { freq: freq * 2.01, at: i * 0.14, attack: 0.15, decay: 1, peak: 0.005 });
    });
  },
  // 昇華音: 駆け上がる分散和音と、残る光
  reward: (ctx, out) => {
    [349.2, 440, 523.25, 698.5, 880, 1046.5].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.06, attack: 0.012, decay: 1, peak: 0.06 });
    });
    whoosh(ctx, out, { from: 400, to: 1600, duration: 0.8, peak: 0.02 });
    tone(ctx, out, { freq: 1318.5, at: 0.38, attack: 0.08, decay: 1.8, peak: 0.02 });
  },
  // 探求度の上昇: 二段に昇る音と、ふわりと開く和音
  levelUp: (ctx, out) => {
    tone(ctx, out, { freq: 392, attack: 0.02, decay: 0.9, peak: 0.05 });
    tone(ctx, out, { freq: 523.25, at: 0.16, attack: 0.02, decay: 1.2, peak: 0.05 });
    [523.25, 659.25, 784].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 0.38 + i * 0.05, attack: 0.12, decay: 2, peak: 0.035 });
    });
  },
  // 魔術階級の昇格: 深い礎の音がふくらみ、聖なる和音が重なって、最後に澄んだ鐘が残る
  rankUp: (ctx, out) => {
    tone(ctx, out, { freq: 130.8, toFreq: 261.6, attack: 0.6, decay: 3, peak: 0.09 });
    whoosh(ctx, out, { from: 200, to: 800, duration: 1.8, peak: 0.025 });
    [261.6, 329.6, 392, 523.25].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 0.6 + i * 0.16, attack: 0.3, decay: 3.2, peak: 0.045 });
    });
    tone(ctx, out, { freq: 784, at: 1.4, attack: 0.03, decay: 3, peak: 0.03 });
    tone(ctx, out, { freq: 784 * 2.01, at: 1.4, attack: 0.03, decay: 1.4, peak: 0.004 });
  },
  // 流れ星の品（常品・稀品）: 小さな水晶がそっと触れ合ったような、澄んだ短い単音
  dropNormal: (ctx, out) => {
    tone(ctx, out, { freq: 1174.7, attack: 0.004, decay: 1.1, peak: 0.05 });
    tone(ctx, out, { freq: 1174.7 * 1.004, attack: 0.004, decay: 0.9, peak: 0.02 });
    tone(ctx, out, { freq: 1174.7 * 2.76, attack: 0.004, decay: 0.25, peak: 0.006 });
    tone(ctx, out, { freq: 587.3, attack: 0.01, decay: 0.6, peak: 0.012 });
  },
  // 流れ星の品（秘宝・至宝）: 深い残響を伴う鐘がひとつ鳴り、その響きの中から和音がゆっくり広がる
  dropRare: (ctx, out) => {
    tone(ctx, out, { freq: 196, attack: 0.02, decay: 4.5, peak: 0.05 });
    tone(ctx, out, { freq: 392, attack: 0.008, decay: 3.8, peak: 0.06 });
    tone(ctx, out, { freq: 392 * 1.19, attack: 0.008, decay: 2.2, peak: 0.012 });
    tone(ctx, out, { freq: 392 * 2.01, attack: 0.008, decay: 1.8, peak: 0.01 });
    tone(ctx, out, { freq: 392 * 2.76, attack: 0.008, decay: 0.9, peak: 0.005 });
    [493.9, 587.3, 784, 880].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 0.35 + i * 0.18, attack: 0.2, decay: 3, peak: 0.032 });
    });
    tone(ctx, out, { freq: 1174.7, at: 1.1, attack: 0.05, decay: 2.4, peak: 0.012 });
  },
  // 称号の解放: 星の砂がさらさらと零れ落ちるような、細く静かなシャワー
  titleUnlock: (ctx, out) => {
    sparkle(ctx, out, { at: 0, count: 16, span: 1.5, peak: 0.014, falling: true });
    whoosh(ctx, out, { from: 2400, to: 1100, duration: 1.8, peak: 0.006 });
    tone(ctx, out, { freq: 392, at: 0.2, attack: 0.6, decay: 2.2, peak: 0.018 });
  },
  // 古代文書の復元: 古い羊皮紙がほどける乾いた音のあと、低く静かな魔力の共鳴がゆっくり立ちのぼる
  restore: (ctx, out) => {
    parchment(ctx, out, { at: 0, duration: 0.7, peak: 0.05 });
    tone(ctx, out, { freq: 87.3, at: 0.25, attack: 0.9, decay: 3.6, peak: 0.07 });
    // 小さなスピーカーでも共鳴が届くよう、倍音を薄く重ねる
    tone(ctx, out, { freq: 174.6, at: 0.3, attack: 0.7, decay: 3.2, peak: 0.045, type: "triangle" });
    [349.2, 440, 523.25, 659.25].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 0.6 + i * 0.28, attack: 0.25, decay: 2.8, peak: 0.035 });
    });
    tone(ctx, out, { freq: 1046.5, at: 1.8, attack: 0.1, decay: 2.4, peak: 0.013 });
  },
  // 還元: 遺物がほどけて星屑へ沈んでいく、下降する短い響き
  dissolve: (ctx, out) => {
    tone(ctx, out, { freq: 880, toFreq: 440, attack: 0.02, decay: 0.6, peak: 0.045 });
    tone(ctx, out, { freq: 659.25, toFreq: 329.6, at: 0.06, attack: 0.02, decay: 0.7, peak: 0.03 });
    whoosh(ctx, out, { from: 1200, to: 300, duration: 0.6, peak: 0.015 });
  },
  // 神話遺物（SS）の錬成: 空間ごと共鳴するような深い礎、交差する光の和音、重い鐘と、舞い上がる星屑のきらめき
  craft: (ctx, out) => {
    tone(ctx, out, { freq: 98, toFreq: 196, attack: 0.8, decay: 3.6, peak: 0.1 });
    tone(ctx, out, { freq: 65.4, at: 0.1, attack: 1.2, decay: 4.4, peak: 0.07 });
    sparkle(ctx, out, { at: 2.3, count: 12, span: 1.3, peak: 0.016, falling: false });
    tone(ctx, out, { freq: 146.8, at: 0.2, attack: 0.8, decay: 3.4, peak: 0.05 });
    whoosh(ctx, out, { from: 150, to: 900, duration: 2.2, peak: 0.03 });
    [293.7, 370, 440, 587.3].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 1 + i * 0.22, attack: 0.3, decay: 3, peak: 0.04 });
    });
    tone(ctx, out, { freq: 196, at: 2.2, attack: 0.02, decay: 4, peak: 0.06 });
    tone(ctx, out, { freq: 196 * 2.76, at: 2.2, attack: 0.02, decay: 2, peak: 0.012 });
    tone(ctx, out, { freq: 587.3, at: 2.25, attack: 0.04, decay: 3.4, peak: 0.03 });
  },
  // プロローグの幕開け（詠唱開始音）: 暗闇の底から重い低音がゆっくりふくらみ、五度の響きが遠くで開く
  prologueOpen: (ctx, out) => {
    tone(ctx, out, { freq: 73.4, toFreq: 98, attack: 1.6, decay: 5.5, peak: 0.12 });
    // 小さなスピーカーでも重さが届くよう、倍音を薄く重ねる
    tone(ctx, out, { freq: 146.8, toFreq: 196, attack: 1.6, decay: 5, peak: 0.05, type: "triangle" });
    tone(ctx, out, { freq: 110, at: 0.8, attack: 1.4, decay: 5, peak: 0.05 });
    whoosh(ctx, out, { from: 120, to: 700, duration: 3.2, peak: 0.03 });
    [293.7, 440].forEach((freq, i) => {
      tone(ctx, out, { freq, at: 2 + i * 0.5, attack: 0.8, decay: 4, peak: 0.025 });
    });
  },
  // 魔力の蓄積: 数え上がる魔力に合わせ、低い共鳴がゆっくりふくらんでいく（約1.3秒のクレッシェンド）
  mannaCharge: (ctx, out) => {
    tone(ctx, out, { freq: 196, attack: 1.1, decay: 1.6, peak: 0.05 });
    tone(ctx, out, { freq: 293.7, at: 0.15, attack: 1, decay: 1.5, peak: 0.035 });
    tone(ctx, out, { freq: 392, at: 0.35, attack: 0.9, decay: 1.4, peak: 0.028 });
    tone(ctx, out, { freq: 587.3, at: 0.6, attack: 0.7, decay: 1.3, peak: 0.014 });
    whoosh(ctx, out, { from: 260, to: 900, duration: 1.3, peak: 0.012 });
  },
  // 魔力の吸入: 高みから深みへ吸い込まれていく風と、底で受け止める低い霊的な響き
  mannaAbsorb: (ctx, out) => {
    whoosh(ctx, out, { from: 1800, to: 220, duration: 1.1, peak: 0.03 });
    tone(ctx, out, { freq: 523.25, toFreq: 130.8, attack: 0.08, decay: 1.1, peak: 0.03 });
    tone(ctx, out, { freq: 98, at: 0.55, attack: 0.5, decay: 2.4, peak: 0.06 });
    tone(ctx, out, { freq: 196, at: 0.6, attack: 0.5, decay: 2, peak: 0.022, type: "triangle" });
  },
  // 記憶の解放: 澄んだ水晶の鐘がひとつ鳴り、細かな光が昇っていく
  memoryUnlock: (ctx, out) => {
    tone(ctx, out, { freq: 1046.5, attack: 0.004, decay: 2.2, peak: 0.05 });
    tone(ctx, out, { freq: 1046.5 * 1.003, attack: 0.004, decay: 1.8, peak: 0.018 });
    tone(ctx, out, { freq: 1046.5 * 2.76, attack: 0.004, decay: 0.5, peak: 0.006 });
    tone(ctx, out, { freq: 523.25, attack: 0.02, decay: 1.6, peak: 0.02 });
    tone(ctx, out, { freq: 784, at: 0.12, attack: 0.05, decay: 2, peak: 0.022 });
    sparkle(ctx, out, { at: 0.2, count: 8, span: 0.9, peak: 0.01, falling: false });
  },
  // プロローグの一節: 遠くで一度だけ鳴る、低く澄んだ鐘
  prologueLine: (ctx, out) => {
    tone(ctx, out, { freq: 146.8, attack: 0.4, decay: 3.2, peak: 0.05 });
    tone(ctx, out, { freq: 587.3, at: 0.05, attack: 0.03, decay: 2.6, peak: 0.03 });
    tone(ctx, out, { freq: 587.3 * 2.76, at: 0.05, attack: 0.03, decay: 1.2, peak: 0.004 });
  },
};

const softChains = new WeakMap<AudioNode, AudioNode>();

/**
 * 効果音の仕上げ: 高域を丸めてから、短い残響を薄く重ねる。
 * 刺さる成分を落としつつ、鳴らした音がふわりと広がって消えるようにする
 */
function softChain(ctx: AudioContext, destination: AudioNode) {
  let input = softChains.get(destination);
  if (input) return input;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2200;
  tone.Q.value = 0.4;
  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  tone.connect(dry);
  dry.connect(reverbSend(ctx, destination, { seconds: 2.2, wet: 0.47, cutoff: 1500 }));
  input = tone;
  softChains.set(destination, input);
  return input;
}

export function synthSe(ctx: AudioContext, key: SeKey, destination: AudioNode) {
  SE[key](ctx, softChain(ctx, destination));
}
