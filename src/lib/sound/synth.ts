// 音声ファイルが無いときに Web Audio API で組み立てる環境音・効果音。
// 環境音はノイズ＋フィルターの風・炎と、正弦波のドローンを重ねて作る。
import type { AmbienceKey, SeKey } from "./sound-files";

export type Voice = {
  /** 声部全体の音量（クロスフェードに使う） */
  output: GainNode;
  stop: () => void;
};

const SILENT = 0.0001;

const noiseBuffers = new WeakMap<BaseAudioContext, { white: AudioBuffer; brown: AudioBuffer }>();

/** 白色ノイズと、低域に寄せたブラウンノイズ（数秒分をループさせる） */
function noise(ctx: BaseAudioContext) {
  let cached = noiseBuffers.get(ctx);
  if (cached) return cached;
  const length = ctx.sampleRate * 4;
  const white = ctx.createBuffer(1, length, ctx.sampleRate);
  const brown = ctx.createBuffer(1, length, ctx.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    w[i] = Math.random() * 2 - 1;
    last = (last + 0.02 * w[i]) / 1.02;
    b[i] = last * 3.5;
  }
  cached = { white, brown };
  noiseBuffers.set(ctx, cached);
  return cached;
}

type Layer = { sources: AudioScheduledSourceNode[]; timers: ReturnType<typeof setTimeout>[] };

function loop(ctx: AudioContext, buffer: AudioBuffer, layer: Layer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  // 同じノイズを重ねても揃わないよう、再生位置をずらす
  src.start(0, Math.random() * buffer.duration);
  layer.sources.push(src);
  return src;
}

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

/** 風: 帯域ノイズの中心と強さをゆっくり揺らす */
function wind(ctx: AudioContext, out: AudioNode, layer: Layer, o: { center: number; q: number; level: number; rate: number }) {
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = o.center;
  filter.Q.value = o.q;
  const gain = ctx.createGain();
  gain.gain.value = o.level;
  loop(ctx, noise(ctx).white, layer).connect(filter).connect(gain).connect(out);
  lfo(ctx, o.rate, o.center * 0.4, filter.frequency, layer);
  lfo(ctx, o.rate * 0.73, o.level * 0.45, gain.gain, layer);
}

/** 低いうなり（暖炉の炎・炉の唸り・遠い森鳴り） */
function rumble(ctx: AudioContext, out: AudioNode, layer: Layer, o: { cutoff: number; level: number }) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = o.cutoff;
  const gain = ctx.createGain();
  gain.gain.value = o.level;
  loop(ctx, noise(ctx).brown, layer).connect(filter).connect(gain).connect(out);
  lfo(ctx, 0.11, o.level * 0.3, gain.gain, layer);
}

/** 薪のはぜる音: 不規則な間隔で短いノイズを鳴らす */
function crackles(ctx: AudioContext, out: AudioNode, layer: Layer, o: { interval: number; level: number }) {
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;
  filter.connect(out);
  const pop = () => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx).white;
    const gain = ctx.createGain();
    const peak = o.level * (0.3 + Math.random() * 0.7);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(SILENT, t + 0.01 + Math.random() * 0.04);
    src.connect(gain).connect(filter);
    src.start(t, Math.random() * 3, 0.08);
    // 弾けたあとに小さな余韻が続くことがある
    const next = o.interval * (0.25 + Math.random() * 1.5) * (Math.random() < 0.3 ? 0.15 : 1);
    layer.timers.push(setTimeout(pop, next));
  };
  layer.timers.push(setTimeout(pop, o.interval));
}

/** 持続音の和音。各音の強さを別々の周期で揺らし、呼吸するように響かせる */
function drone(
  ctx: AudioContext,
  out: AudioNode,
  layer: Layer,
  o: { freqs: number[]; level: number; type?: OscillatorType; cutoff?: number },
) {
  let dest: AudioNode = out;
  if (o.cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = o.cutoff;
    filter.connect(out);
    dest = filter;
  }
  o.freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    const gain = ctx.createGain();
    gain.gain.value = o.level * 0.6;
    osc.connect(gain).connect(dest);
    osc.start();
    layer.sources.push(osc);
    lfo(ctx, 0.04 + i * 0.023, o.level * 0.4, gain.gain, layer);
  });
}

const AMBIENCE: Record<AmbienceKey, (ctx: AudioContext, out: AudioNode, layer: Layer) => void> = {
  // 小屋: 静かな暖炉と、壁の外を抜ける風
  hearth: (ctx, out, l) => {
    rumble(ctx, out, l, { cutoff: 320, level: 0.45 });
    crackles(ctx, out, l, { interval: 420, level: 0.22 });
    wind(ctx, out, l, { center: 520, q: 0.8, level: 0.1, rate: 0.07 });
  },
  // 樹海・図書室: 梢を渡る深い風と静けさ
  forest: (ctx, out, l) => {
    wind(ctx, out, l, { center: 380, q: 0.5, level: 0.3, rate: 0.05 });
    wind(ctx, out, l, { center: 1300, q: 1.4, level: 0.06, rate: 0.12 });
    rumble(ctx, out, l, { cutoff: 140, level: 0.25 });
  },
  // 観測塔・星空: 高音の和音ドローンと、かすかな星のきらめき
  stars: (ctx, out, l) => {
    drone(ctx, out, l, { freqs: [1046.5, 1318.5, 1568, 2093], level: 0.035 });
    drone(ctx, out, l, { freqs: [261.6], level: 0.04 });
    wind(ctx, out, l, { center: 6500, q: 0.9, level: 0.025, rate: 0.09 });
  },
  // 氷の回廊: 細く鳴る風と、冷たい倍音
  frost: (ctx, out, l) => {
    wind(ctx, out, l, { center: 900, q: 1.6, level: 0.18, rate: 0.08 });
    drone(ctx, out, l, { freqs: [1760, 2637], level: 0.02 });
  },
  // 魔導炉: 深い炉の唸りと、はぜる熾火
  forge: (ctx, out, l) => {
    rumble(ctx, out, l, { cutoff: 220, level: 0.55 });
    crackles(ctx, out, l, { interval: 260, level: 0.26 });
    drone(ctx, out, l, { freqs: [110, 165], level: 0.04, type: "triangle", cutoff: 400 });
  },
  // 大聖堂: 柔らかな聖歌のような和音
  sanctum: (ctx, out, l) => {
    drone(ctx, out, l, { freqs: [220, 277.2, 329.6, 440], level: 0.045, type: "triangle", cutoff: 1200 });
    wind(ctx, out, l, { center: 2600, q: 0.6, level: 0.025, rate: 0.06 });
  },
};

/** 生成した環境音の声部（音量 0 から始まる） */
export function synthAmbience(ctx: AudioContext, key: AmbienceKey, destination: AudioNode): Voice {
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(destination);
  const layer: Layer = { sources: [], timers: [] };
  AMBIENCE[key](ctx, output, layer);
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

function tone(ctx: AudioContext, out: AudioNode, o: ToneOptions) {
  const t = ctx.currentTime + (o.at ?? 0);
  const attack = o.attack ?? 0.005;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.toFreq) osc.frequency.exponentialRampToValueAtTime(o.toFreq, t + attack + o.decay * 0.6);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.exponentialRampToValueAtTime(o.peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + attack + o.decay);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + attack + o.decay + 0.05);
}

/** 帯域を滑らせるノイズ（魔力が渦を巻く気配） */
function whoosh(ctx: AudioContext, out: AudioNode, o: { from: number; to: number; duration: number; peak: number }) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx).white;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(o.from, t);
  filter.frequency.exponentialRampToValueAtTime(o.to, t + o.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.exponentialRampToValueAtTime(o.peak, t + o.duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + o.duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random() * 2, o.duration + 0.05);
}

const SE: Record<SeKey, (ctx: AudioContext, out: AudioNode) => void> = {
  // 控えめなクリスタル音
  tap: (ctx, out) => {
    tone(ctx, out, { freq: 2637, decay: 0.32, peak: 0.08 });
    tone(ctx, out, { freq: 3951, at: 0.012, decay: 0.22, peak: 0.035 });
  },
  // 静かな魔法陣起動音: 低くから昇る光と、開く和音
  chantStart: (ctx, out) => {
    tone(ctx, out, { freq: 196, toFreq: 587, attack: 0.35, decay: 1.6, peak: 0.1 });
    whoosh(ctx, out, { from: 300, to: 2400, duration: 1.3, peak: 0.05 });
    tone(ctx, out, { freq: 587.3, at: 0.7, attack: 0.08, decay: 1.6, peak: 0.05 });
    tone(ctx, out, { freq: 880, at: 0.8, attack: 0.08, decay: 1.8, peak: 0.04 });
    tone(ctx, out, { freq: 1760, at: 0.9, decay: 1.4, peak: 0.02 });
  },
  // 神聖な魔力集束チャイム
  chantComplete: (ctx, out) => {
    [784, 1046.5, 1318.5, 1568, 2093].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.13, attack: 0.01, decay: 2.4, peak: 0.12 });
      tone(ctx, out, { freq: freq * 2.01, at: i * 0.13, decay: 1.2, peak: 0.02 });
    });
  },
  // 昇華音: 駆け上がる分散和音と、残る光
  reward: (ctx, out) => {
    [523.25, 659.25, 784, 1046.5, 1318.5, 1568].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.055, decay: 0.9, peak: 0.07, type: "triangle" });
    });
    whoosh(ctx, out, { from: 800, to: 6000, duration: 0.7, peak: 0.03 });
    tone(ctx, out, { freq: 2093, at: 0.35, attack: 0.05, decay: 1.6, peak: 0.045 });
    tone(ctx, out, { freq: 3136, at: 0.4, attack: 0.05, decay: 1.3, peak: 0.02 });
  },
};

export function synthSe(ctx: AudioContext, key: SeKey, destination: AudioNode) {
  SE[key](ctx, destination);
}
