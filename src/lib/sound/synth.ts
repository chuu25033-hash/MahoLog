// 音声ファイルが無いときに Web Audio API で組み立てる環境音・効果音。
// 音の軸は詠唱開始音（低くから昇る光と、ゆっくり開く和音）。すべて低音〜中音域に寄せ、柔らかい残響で包む。
// 環境音はノイズを使わず、空気のゆらぎのような超低域ドローンと、ときおり響く星鳴り（サイン波の和音）で作る。
// タイトル画面だけは、柔らかいピアノとオルゴールの静かなコード進行を流す。
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

/** 星鳴り: ときおり、透き通ったサイン波の和音がゆっくり灯って長く消えていく */
function starChimes(
  ctx: AudioContext,
  out: AudioNode,
  layer: Layer,
  o: { notes: number[]; interval: number; level: number },
) {
  const send = reverbSend(ctx, out, { seconds: 4, wet: 0.6, cutoff: 1800 });
  const ring = () => {
    const t = ctx.currentTime + 0.05;
    // 2〜3音を少しずつずらして重ねる
    const count = 2 + Math.round(Math.random());
    const start = Math.floor(Math.random() * (o.notes.length - count + 1));
    o.notes.slice(start, start + count).forEach((freq, i) => {
      const at = t + i * (0.18 + Math.random() * 0.2);
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(o.level * (0.6 + Math.random() * 0.4), at + 0.5);
      gain.gain.exponentialRampToValueAtTime(SILENT, at + 6);
      osc.connect(gain).connect(send);
      osc.start(at);
      osc.stop(at + 6.1);
    });
    layer.timers.push(setTimeout(ring, o.interval * (0.6 + Math.random() * 0.8)));
  };
  layer.timers.push(setTimeout(ring, o.interval * 0.3));
}

/** 滞在する地ごとの響き: 根音（超低域ドローン）と、星鳴りの和音・間隔 */
const SOUNDSCAPES: Record<Exclude<AmbienceKey, "title">, { root: number; notes: number[]; interval: number }> = {
  // 旅立ちの前（ログイン・星天の導き）: D
  prelude: { root: midi(26), notes: [midi(62), midi(66), midi(69), midi(74)], interval: 5000 },
  // 小屋: 温かな A
  hearth: { root: midi(33), notes: [midi(57), midi(61), midi(64), midi(69)], interval: 7500 },
  // 樹海・図書室: 深い G
  forest: { root: midi(31), notes: [midi(55), midi(59), midi(62), midi(67)], interval: 8500 },
  // 観測塔・星空: 澄んだ C。星鳴りがやや高く、多く灯る
  stars: { root: midi(36), notes: [midi(64), midi(67), midi(71), midi(72), midi(76)], interval: 5000 },
  // 氷の回廊: 冷たい B の空虚五度
  frost: { root: midi(35), notes: [midi(59), midi(66), midi(71), midi(78)], interval: 7000 },
  // 魔導炉: 最も低い E
  forge: { root: midi(28), notes: [midi(52), midi(56), midi(59), midi(64)], interval: 9000 },
  // 大聖堂: 荘厳な F
  sanctum: { root: midi(29), notes: [midi(53), midi(57), midi(60), midi(65), midi(69)], interval: 6000 },
};

function soundscape(ctx: AudioContext, out: AudioNode, layer: Layer, key: Exclude<AmbienceKey, "title">) {
  const s = SOUNDSCAPES[key];
  airDrone(ctx, out, layer, { root: s.root, level: 0.32 });
  starChimes(ctx, out, layer, { notes: s.notes, interval: s.interval, level: 0.045 });
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

/** タイトルの和音進行（ゆっくり下りていく Fmaj7 → Em7 → Dm7 → Cmaj7）。旋律はその和音の音から選ぶ */
const TITLE_CHORDS = [
  { bass: 41, chord: [57, 60, 64], melody: [69, 72, 76, 77] },
  { bass: 40, chord: [55, 59, 62], melody: [67, 71, 74, 76] },
  { bass: 38, chord: [57, 60, 65], melody: [65, 69, 72, 74] },
  { bass: 36, chord: [55, 59, 64], melody: [64, 67, 71, 72] },
];
/** 1つの和音を鳴らす長さ（秒） */
const TITLE_BAR_SEC = 4.8;
/** 小節内でオルゴールが鳴りうる位置（拍） */
const TITLE_SLOTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];

/** タイトルの曲: ピアノの分散和音に、オルゴールの旋律を毎回少しずつ変えて重ね、繰り返す */
function titleMusic(ctx: AudioContext, out: AudioNode, layer: Layer) {
  const send = reverbSend(ctx, out, { seconds: 3.5, wet: 0.55, cutoff: 2200 });
  // フェルトをかけたように、ピアノの高域を丸める
  const pianoTone = ctx.createBiquadFilter();
  pianoTone.type = "lowpass";
  pianoTone.frequency.value = 1600;
  pianoTone.connect(send);
  const boxTone = ctx.createBiquadFilter();
  boxTone.type = "lowpass";
  boxTone.frequency.value = 3200;
  boxTone.connect(send);

  const beat = TITLE_BAR_SEC / 4;
  let bar = 0;
  let next = ctx.currentTime + 0.3;
  const schedule = () => {
    const { bass, chord, melody } = TITLE_CHORDS[bar % TITLE_CHORDS.length];
    const t = next;
    piano(ctx, pianoTone, midi(bass), t, 0.11);
    chord.forEach((note, i) => piano(ctx, pianoTone, midi(note), t + 0.22 * (i + 1), 0.06));
    // 小節の後半にもう一度、和音をそっと置く
    piano(ctx, pianoTone, midi(chord[0]), t + beat * 2, 0.035);
    piano(ctx, pianoTone, midi(chord[2]), t + beat * 2 + 0.2, 0.03);
    // オルゴールは 1 オクターブ上で、3〜4音だけ
    const slots = [...TITLE_SLOTS].sort(() => Math.random() - 0.5).slice(0, 3 + Math.round(Math.random()));
    slots.forEach((slot) => {
      const note = melody[Math.floor(Math.random() * melody.length)] + 12;
      musicBox(ctx, boxTone, midi(note), t + slot * beat, 0.035);
    });
    bar += 1;
    next += TITLE_BAR_SEC;
    layer.timers.push(setTimeout(schedule, Math.max(0, (next - ctx.currentTime - 0.6) * 1000)));
  };
  schedule();
}

/** 生成した環境音の声部（音量 0 から始まる） */
export function synthAmbience(ctx: AudioContext, key: AmbienceKey, destination: AudioNode): Voice {
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(destination);
  const layer: Layer = { sources: [], timers: [] };
  if (key === "title") titleMusic(ctx, output, layer);
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
  // タップ: 深く澄んだ小石や水晶が静かに鳴る短音（芯の音に、水晶らしい非整数倍の響きを薄く添える）
  tap: (ctx, out) => {
    tone(ctx, out, { freq: 587.3, attack: 0.006, decay: 0.45, peak: 0.06 });
    tone(ctx, out, { freq: 293.7, attack: 0.006, decay: 0.2, peak: 0.02 });
    tone(ctx, out, { freq: 587.3 * 2.76, attack: 0.006, decay: 0.22, peak: 0.01 });
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
