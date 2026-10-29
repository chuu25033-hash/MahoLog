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

/** 2段のローパスで高域を深く落とす（1段より急な傾きで、こもった音になる） */
function muffle(ctx: AudioContext, cutoff: number) {
  const first = ctx.createBiquadFilter();
  const second = ctx.createBiquadFilter();
  for (const f of [first, second]) {
    f.type = "lowpass";
    f.frequency.value = cutoff;
    f.Q.value = 0.5;
  }
  first.connect(second);
  return { input: first, output: second, frequency: [first.frequency, second.frequency] };
}

/** 風: 低域だけを残したノイズ。強さと明るさをごくゆっくり揺らし、遠くで静かに包み込む音にする */
function wind(ctx: AudioContext, out: AudioNode, layer: Layer, o: { cutoff: number; level: number; rate: number }) {
  const filter = muffle(ctx, o.cutoff);
  const gain = ctx.createGain();
  gain.gain.value = o.level;
  loop(ctx, noise(ctx).white, layer).connect(filter.input);
  filter.output.connect(gain).connect(out);
  filter.frequency.forEach((param) => lfo(ctx, o.rate, o.cutoff * 0.2, param, layer));
  lfo(ctx, o.rate * 0.61, o.level * 0.22, gain.gain, layer);
}

/** 低いうなり（暖炉の炎・炉の唸り・遠い森鳴り） */
function rumble(ctx: AudioContext, out: AudioNode, layer: Layer, o: { cutoff: number; level: number }) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = o.cutoff;
  const gain = ctx.createGain();
  gain.gain.value = o.level;
  loop(ctx, noise(ctx).brown, layer).connect(filter).connect(gain).connect(out);
  lfo(ctx, 0.05, o.level * 0.2, gain.gain, layer);
}

/**
 * 薪のはぜる音: 不規則な間隔で小さなノイズの粒を鳴らす。
 * 立ち上がりを少し遅らせ、高域を強く削って、硬い「カチッ」ではなく丸い「ぽつ」「パチ」にする
 */
function crackles(ctx: AudioContext, out: AudioNode, layer: Layer, o: { interval: number; level: number }) {
  // 低いこもりは除き、粒の芯だけを残す
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 180;
  highpass.connect(out);
  const pop = () => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx).white;
    // 粒ごとに明るさを変えて、同じ音の繰り返しに聞こえないようにする
    const filter = muffle(ctx, 500 + Math.random() * 700);
    const gain = ctx.createGain();
    const peak = o.level * (0.3 + Math.random() * 0.7);
    const attack = 0.004 + Math.random() * 0.006;
    const decay = 0.04 + Math.random() * 0.08;
    gain.gain.setValueAtTime(SILENT, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
    src.connect(filter.input);
    filter.output.connect(gain).connect(highpass);
    src.start(t, Math.random() * 3, attack + decay + 0.02);
    // ときおり小さな爆ぜが続けて起こる
    const next = o.interval * (0.4 + Math.random() * 1.4) * (Math.random() < 0.2 ? 0.25 : 1);
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
    rumble(ctx, out, l, { cutoff: 260, level: 0.4 });
    crackles(ctx, out, l, { interval: 900, level: 0.35 });
    wind(ctx, out, l, { cutoff: 280, level: 0.16, rate: 0.03 });
  },
  // 樹海・図書室: 梢を渡る深い風と静けさ
  forest: (ctx, out, l) => {
    wind(ctx, out, l, { cutoff: 320, level: 0.4, rate: 0.025 });
    wind(ctx, out, l, { cutoff: 220, level: 0.2, rate: 0.04 });
    rumble(ctx, out, l, { cutoff: 140, level: 0.25 });
  },
  // 観測塔・星空: 高音の和音ドローンと、かすかな星のきらめき
  stars: (ctx, out, l) => {
    drone(ctx, out, l, { freqs: [1046.5, 1318.5, 1568, 2093], level: 0.035 });
    drone(ctx, out, l, { freqs: [261.6], level: 0.04 });
    wind(ctx, out, l, { cutoff: 240, level: 0.12, rate: 0.03 });
  },
  // 氷の回廊: 細く鳴る風と、冷たい倍音
  frost: (ctx, out, l) => {
    wind(ctx, out, l, { cutoff: 350, level: 0.35, rate: 0.035 });
    drone(ctx, out, l, { freqs: [1760, 2637], level: 0.02 });
  },
  // 魔導炉: 深い炉の唸りと、はぜる熾火
  forge: (ctx, out, l) => {
    rumble(ctx, out, l, { cutoff: 220, level: 0.55 });
    crackles(ctx, out, l, { interval: 600, level: 0.35 });
    drone(ctx, out, l, { freqs: [110, 165], level: 0.04, type: "triangle", cutoff: 400 });
  },
  // 大聖堂: 柔らかな聖歌のような和音
  sanctum: (ctx, out, l) => {
    drone(ctx, out, l, { freqs: [220, 277.2, 329.6, 440], level: 0.045, type: "triangle", cutoff: 1200 });
    wind(ctx, out, l, { cutoff: 260, level: 0.12, rate: 0.025 });
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
  // 控えめなクリスタル音: 高すぎない音域で、ふわりと立ち上げる
  tap: (ctx, out) => {
    tone(ctx, out, { freq: 1318.5, attack: 0.012, decay: 0.55, peak: 0.07 });
    tone(ctx, out, { freq: 1975.5, at: 0.015, attack: 0.012, decay: 0.4, peak: 0.022 });
  },
  // 静かな魔法陣起動音: 低くから昇る光と、ゆっくり開く和音
  chantStart: (ctx, out) => {
    tone(ctx, out, { freq: 196, toFreq: 440, attack: 0.45, decay: 1.8, peak: 0.1 });
    whoosh(ctx, out, { from: 250, to: 1100, duration: 1.4, peak: 0.035 });
    tone(ctx, out, { freq: 440, at: 0.7, attack: 0.15, decay: 1.8, peak: 0.05 });
    tone(ctx, out, { freq: 659.25, at: 0.8, attack: 0.15, decay: 2, peak: 0.035 });
    tone(ctx, out, { freq: 880, at: 0.9, attack: 0.12, decay: 1.6, peak: 0.015 });
  },
  // 神聖な魔力集束チャイム: 柔らかな打鍵と長い余韻
  chantComplete: (ctx, out) => {
    [523.25, 659.25, 784, 1046.5, 1318.5].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.14, attack: 0.02, decay: 2.6, peak: 0.11 });
      tone(ctx, out, { freq: freq * 2.01, at: i * 0.14, attack: 0.02, decay: 1, peak: 0.01 });
    });
  },
  // 昇華音: 駆け上がる分散和音と、残る光
  reward: (ctx, out) => {
    [392, 493.9, 587.3, 784, 987.8, 1174.7].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.06, attack: 0.012, decay: 1, peak: 0.065 });
    });
    whoosh(ctx, out, { from: 400, to: 2200, duration: 0.8, peak: 0.02 });
    tone(ctx, out, { freq: 1568, at: 0.38, attack: 0.08, decay: 1.8, peak: 0.03 });
    tone(ctx, out, { freq: 2093, at: 0.44, attack: 0.08, decay: 1.4, peak: 0.01 });
  },
};

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
  tone.frequency.value = 2800;
  tone.Q.value = 0.4;
  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx, 2.2);
  const wetTone = ctx.createBiquadFilter();
  wetTone.type = "lowpass";
  wetTone.frequency.value = 1800;
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  tone.connect(dry).connect(destination);
  tone.connect(reverb).connect(wetTone).connect(wet).connect(destination);
  input = tone;
  softChains.set(destination, input);
  return input;
}

export function synthSe(ctx: AudioContext, key: SeKey, destination: AudioNode) {
  SE[key](ctx, softChain(ctx, destination));
}
