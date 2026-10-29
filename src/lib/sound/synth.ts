// 音声ファイルが無いときに Web Audio API で組み立てる環境音・効果音。
// 音の軸は詠唱開始音（低くから昇る光と、ゆっくり開く和音）。すべて低音〜中音域に寄せ、柔らかい残響で包む。
// 環境音（BGM）はノイズを使わず、柔らかいピアノとオルゴールの静かなコード進行で作る。
// タイトルとステージごとに調と進行を変え、ステージでは空気のゆらぎ（超低域ドローン）を下に薄く敷く。
import type { AmbienceKey, SeKey } from "./sound-files";

export type Voice = {
  /** 声部全体の音量（クロスフェードに使う） */
  output: GainNode;
  stop: () => void;
};

const SILENT = 0.0001;

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Layer = { sources: AudioScheduledSourceNode[]; timers: ReturnType<typeof setTimeout>[] };

/** ゆっくり揺らす低周波 */
function lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam, layer: Layer) {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = depth;
  osc.connect(gain).connect(target);
  osc.start();
  layer.sources.push(osc);
}

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

/**
 * 空気のゆらぎ: 超低域のサイン波を、わずかにずらした音と重ねてゆっくりうねらせる。
 * 小さなスピーカーでも気配が伝わるよう、1オクターブ上をごく薄く添える
 */
function airDrone(ctx: AudioContext, out: AudioNode, layer: Layer, o: { root: number; level: number }) {
  const gain = ctx.createGain();
  gain.gain.value = o.level;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 260;
  gain.connect(filter).connect(out);
  const partials: [ratio: number, amp: number, detune: number][] = [
    [1, 1, 0],
    [1, 0.7, 0.18],
    [2, 0.3, 0.11],
    [3, 0.07, 0],
  ];
  for (const [ratio, amp, beat] of partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = o.root * ratio + beat;
    const g = ctx.createGain();
    g.gain.value = amp;
    osc.connect(g).connect(gain);
    osc.start();
    layer.sources.push(osc);
  }
  lfo(ctx, 0.023, o.level * 0.3, gain.gain, layer);
}

/** 柔らかいピアノ: 弱めの打鍵でふくらみ、高い倍音から先に消えていく */
function piano(ctx: AudioContext, out: AudioNode, freq: number, at: number, level: number) {
  const partials: [ratio: number, amp: number, decay: number][] = [
    [1, 1, 4.5],
    [2.003, 0.35, 2.4],
    [3.008, 0.12, 1.4],
    [4.015, 0.05, 0.9],
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

type Chord = { bass: number; chord: number[]; melody: number[] };

/** 和音（MIDI 番号）。旋律の候補は和音の音を1オクターブ上げたものに、添えたい音を足す */
const ch = (bass: number, chord: number[], extra: number[] = []): Chord => ({
  bass,
  chord,
  melody: [...chord.map((n) => n + 12), ...extra],
});

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
  const schedule = () => {
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
    layer.timers.push(setTimeout(schedule, Math.max(0, (next - ctx.currentTime - 0.6) * 1000)));
  };
  schedule();
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

/**
 * 滞在する地ごとの曲。タイトルと同じピアノとオルゴールで、調と和音進行を変え、
 * 少しゆっくり・控えめに奏でる。オルゴールはタイトルより1オクターブ低く、高域も丸めて落ち着かせる。
 * 下には空気のゆらぎ（超低域ドローン）を薄く敷く
 */
const STAGE_PIECE = {
  barSec: 5.6,
  piano: 0.85,
  box: 0.026,
  boxNotes: [1, 2],
  afterBeat: false,
  boxOctave: 0,
  boxCutoff: 1800,
} satisfies Omit<Piece, "chords">;

const SOUNDSCAPES: Record<Exclude<AmbienceKey, "title">, { root: number; chords: Chord[] }> = {
  // 旅立ちの前（星天の導き）: C の明るい進行 Cmaj7 → Am7 → Fmaj7 → G6
  prelude: { root: midi(24), chords: [ch(36, [55, 59, 64]), ch(33, [55, 60, 64]), ch(41, [57, 60, 64]), ch(43, [59, 62, 64])] },
  // 小屋: G の温かな下行 Cmaj7 → Bm7 → Am7 → Gmaj7
  hearth: { root: midi(31), chords: [ch(36, [55, 59, 64]), ch(35, [54, 57, 62]), ch(33, [55, 60, 64]), ch(31, [54, 59, 62])] },
  // 樹海・図書室: D の深い響き Dm9 → B♭maj7 → Fmaj7 → C(add9)
  forest: { root: midi(26), chords: [ch(38, [57, 60, 64]), ch(34, [57, 62, 65]), ch(41, [57, 60, 64]), ch(36, [55, 62, 64])] },
  // 観測塔・星空: E の澄んだ下行 Amaj7 → G♯m7 → F♯m7 → Emaj7
  stars: { root: midi(28), chords: [ch(45, [61, 64, 68]), ch(44, [59, 63, 66]), ch(42, [57, 61, 64]), ch(40, [59, 63, 68])] },
  // 氷の回廊: B マイナーの静けさ Gmaj7 → F♯m7 → Em7 → Bm(add9)
  frost: { root: midi(35), chords: [ch(43, [59, 62, 66]), ch(42, [57, 61, 64]), ch(40, [59, 62, 67]), ch(35, [59, 61, 62])] },
  // 魔導炉: E マイナーの重み Cmaj7 → Am7 → Bm7 → Em7
  forge: { root: midi(28), chords: [ch(36, [55, 59, 64]), ch(33, [55, 60, 64]), ch(35, [54, 57, 62]), ch(40, [55, 59, 62])] },
  // 大聖堂: F の荘厳な進行 B♭maj7 → C6 → Am7 → Dm7
  sanctum: { root: midi(29), chords: [ch(34, [57, 62, 65]), ch(36, [57, 60, 64]), ch(33, [55, 60, 64]), ch(38, [57, 60, 65])] },
};

function soundscape(ctx: AudioContext, out: AudioNode, layer: Layer, key: Exclude<AmbienceKey, "title">) {
  const s = SOUNDSCAPES[key];
  airDrone(ctx, out, layer, { root: s.root, level: 0.18 });
  pianoPiece(ctx, out, layer, { ...STAGE_PIECE, chords: s.chords });
}

/** 生成した環境音の声部（音量 0 から始まる） */
export function synthAmbience(ctx: AudioContext, key: AmbienceKey, destination: AudioNode): Voice {
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(destination);
  const layer: Layer = { sources: [], timers: [] };
  if (key === "title") pianoPiece(ctx, output, layer, TITLE_PIECE);
  else soundscape(ctx, output, layer, key);
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

/** 帯域を滑らせるノイズ（魔力が渦を巻く気配） */
function whoosh(ctx: AudioContext, out: AudioNode, o: { from: number; to: number; duration: number; peak: number }) {
  if (whiteNoise?.ctx !== ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    whiteNoise = { ctx, buffer };
  }
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise.buffer;
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
