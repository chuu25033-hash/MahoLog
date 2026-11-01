// エリアごとの環境音。曲の後ろで、その場所の空気をごく薄く鳴らす。
// 音声ファイルは使わず、ノイズと発振器から組み立てる。続く音（炎のうなり・炉）と、ときどき鳴る音
// （頁をめくる音・木の軋み・虫・水滴・溶岩・火竜の寝息・鐘・天文盤・氷の粒・フクロウ）を重ねる。
// 風の音（砂嵐のような「ザー」）、薪や熾火のはぜる音（かちかち）、雨粒を散らした音（からから）は、耳について心地よくないので使わない。
//  - タイトル: 遠くの虫とフクロウ
//  - 旅立ちの前: まばらな虫
//  - 小屋: 暖炉の低いうなり、ときどき頁をめくる音と古い床の軋み、遠いフクロウ
//  - 樹海・図書室: 根を伝う水滴、虫の声、大樹の軋み、頁をめくる音、フクロウ
//  - 観測塔: 天文盤の歯車の音と軋み、ずっと下から届くフクロウ
//  - 氷の回廊: 氷の粒が触れ合う音
//  - 魔導炉: 炉の低いうなり、溶岩の泡、火竜の深い寝息
//  - 大聖堂: 遠くで鳴る鐘
//  - 星天の塔: 遠い星の鳴る音
import type { AmbienceKey } from "./sound-files";

const SILENT = 0.0001;
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 4秒の白色ノイズ（文脈ごとに一度だけ作る） */
function noise(ctx: BaseAudioContext) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** その場所の響き: 減衰していくノイズ */
function spaceImpulse(ctx: BaseAudioContext, seconds: number) {
  const buffer = ctx.createBuffer(2, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      const p = i / data.length;
      smooth += (0.6 - p * 0.45) * (Math.random() * 2 - 1 - smooth);
      data[i] = smooth * (1 - p) ** 2.4;
    }
  }
  return buffer;
}

type Env = {
  ctx: BaseAudioContext;
  /** 素の音の行き先と、響きへ送る行き先 */
  dry: AudioNode;
  wet: AudioNode;
};

const filterOf = (ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, Q?: number) => {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  if (Q !== undefined) f.Q.value = Q;
  return f;
};

/** 1つの音の出口: 左右の位置と、響きへ送る量を決める */
function voice(env: Env, o: { pan?: number; wet?: number; dry?: number } = {}) {
  const { ctx } = env;
  const input = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = o.pan ?? rand(-0.7, 0.7);
  input.connect(pan);
  const dry = ctx.createGain();
  dry.gain.value = o.dry ?? 1;
  pan.connect(dry).connect(env.dry);
  const wet = ctx.createGain();
  wet.gain.value = o.wet ?? 0.4;
  pan.connect(wet).connect(env.wet);
  return input;
}

/** ノイズを鳴らす（start からの長さ。offset はノイズのどこから読むか） */
function noiseSource(ctx: BaseAudioContext, at: number, length: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.start(at, rand(0, 3.5), length);
  return src;
}

/** 減衰する短いノイズ（はぜる音・打つ音の芯） */
function burst(env: Env, out: AudioNode, at: number, o: { type: BiquadFilterType; freq: number; Q?: number; peak: number; decay: number; attack?: number }) {
  const { ctx } = env;
  const attack = o.attack ?? 0.001;
  const src = noiseSource(ctx, at, attack + o.decay + 0.02);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(o.peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, at + attack + o.decay);
  src.connect(filterOf(ctx, o.type, o.freq, o.Q)).connect(gain).connect(out);
}

/** 正弦波の短い音（高さを滑らせられる） */
function tone(env: Env, out: AudioNode, at: number, o: { from: number; to?: number; sweep?: number; peak: number; decay: number; attack?: number; type?: OscillatorType }) {
  const { ctx } = env;
  const attack = o.attack ?? 0.002;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.from, at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + (o.sweep ?? o.decay));
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(o.peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, at + attack + o.decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + attack + o.decay + 0.05);
}

// ---------------------------------------------------------------- 続く音

type Bed = { sources: AudioScheduledSourceNode[]; /** 揺らぎを at から先に予約する */ sway: (at: number) => void };

/** 炎や炉のうなり: 低くこもったノイズを、ちらつくように揺らす */
function roar(env: Env, o: { cutoff: number; level: number; flicker: number }): Bed {
  const { ctx } = env;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const low = filterOf(ctx, "lowpass", o.cutoff, 0.7);
  const gain = ctx.createGain();
  gain.gain.value = o.level;
  src.connect(low).connect(filterOf(ctx, "highpass", 40)).connect(gain).connect(voice(env, { pan: rand(-0.2, 0.2), wet: 0.2 }));
  src.start(ctx.currentTime, rand(0, 3));
  return {
    sources: [src],
    sway: (at) => {
      gain.gain.setTargetAtTime(o.level * rand(1 - o.flicker, 1 + o.flicker), at, rand(0.08, 0.4));
      low.frequency.setTargetAtTime(o.cutoff * rand(0.8, 1.25), at, rand(0.1, 0.5));
    },
  };
}

// ---------------------------------------------------------------- ときどき鳴る音

type Sound = (env: Env, at: number) => void;

/** 頁をめくる音: 紙が擦れて波打つ音のあと、そっと頁が落ちる */
const pageTurn =
  (level: number): Sound =>
  (env, at) => {
    const { ctx } = env;
    const out = voice(env, { wet: 0.3 });
    const length = rand(0.35, 0.55);
    const src = noiseSource(ctx, at, length + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    // 紙がしなって擦れるたびの、細かな強弱
    for (let t = 0; t < length; t += 0.015) {
      const shape = Math.sin((Math.PI * t) / length);
      gain.gain.linearRampToValueAtTime(level * shape * rand(0.4, 1), at + t);
    }
    gain.gain.linearRampToValueAtTime(0, at + length);
    src.connect(filterOf(ctx, "bandpass", rand(2400, 3400), 0.7)).connect(filterOf(ctx, "highpass", 600)).connect(gain).connect(out);
    burst(env, out, at + length - 0.02, { type: "lowpass", freq: 500, peak: level * 0.6, decay: 0.08, attack: 0.01 });
  };

/** 木の軋み: 引っかかっては滑る振動（高さが揺れ、細かく途切れる） */
const creak =
  (o: { low: number; high: number; level: number; length: [number, number] }): Sound =>
  (env, at) => {
    const { ctx } = env;
    const out = voice(env, { wet: 0.45 });
    const f = rand(o.low, o.high);
    const length = rand(...o.length);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, at);
    for (let t = 0.03; t < length; t += 0.03) osc.frequency.linearRampToValueAtTime(f * rand(0.88, 1.12), at + t);
    // 引っかかりの細かな途切れ
    const grain = ctx.createOscillator();
    grain.type = "square";
    grain.frequency.value = rand(24, 42);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    grain.connect(depth).connect(am.gain);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(o.level, at + length * 0.35);
    gain.gain.linearRampToValueAtTime(o.level * 0.7, at + length * 0.7);
    gain.gain.linearRampToValueAtTime(0, at + length);
    osc.connect(am).connect(filterOf(ctx, "bandpass", f * 4, 2.5)).connect(filterOf(ctx, "lowpass", 2200)).connect(gain).connect(out);
    for (const o2 of [osc, grain]) {
      o2.start(at);
      o2.stop(at + length + 0.05);
    }
  };

/** 虫の声: 高い音を短く刻む「リリッ」を数回 */
const cricket =
  (level: number): Sound =>
  (env, at) => {
    const { ctx } = env;
    const out = voice(env, { wet: 0.5, dry: 0.7 });
    const f = rand(4200, 5200);
    const chirps = 2 + Math.floor(Math.random() * 3);
    const pulses = 3 + Math.floor(Math.random() * 2);
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    let end = at;
    for (let c = 0; c < chirps; c++)
      for (let p = 0; p < pulses; p++) {
        const t = at + c * 0.38 + p * 0.042;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(level, t + 0.006);
        gain.gain.linearRampToValueAtTime(0, t + 0.028);
        end = t + 0.03;
      }
    osc.connect(filterOf(ctx, "lowpass", 6500)).connect(gain).connect(out);
    osc.start(at);
    osc.stop(end + 0.05);
  };

/** 水滴: 「ぽちゃ」と上へ跳ねる短い音 */
const drip =
  (level: number): Sound =>
  (env, at) => {
    const out = voice(env, { wet: 0.9, dry: 0.6 });
    const f = rand(700, 1100);
    tone(env, out, at, { from: f, to: f * 2.2, sweep: 0.03, peak: level, decay: 0.12 });
    if (Math.random() < 0.4) tone(env, out, at + rand(0.2, 0.4), { from: f * 1.3, to: f * 2.6, sweep: 0.025, peak: level * 0.4, decay: 0.08 });
  };

/** 氷の粒・遠い星が触れ合う音: 高い音がいくつか、ばらばらに */
const tinkle =
  (level: number): Sound =>
  (env, at) => {
    const out = voice(env, { wet: 1, dry: 0.5 });
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) tone(env, out, at + rand(0, 0.35), { from: rand(3000, 6500), peak: level * rand(0.4, 1), decay: rand(0.25, 0.5) });
  };

/** 溶岩の泡: 低く「ごぽっ」と上がる音 */
const lava =
  (level: number): Sound =>
  (env, at) => {
    const out = voice(env, { pan: rand(-0.5, 0.5), wet: 0.3 });
    tone(env, out, at, { from: rand(55, 80), to: rand(150, 200), sweep: 0.09, peak: level, decay: 0.22, attack: 0.01 });
    burst(env, out, at + 0.05, { type: "lowpass", freq: 400, peak: level * 0.5, decay: 0.12, attack: 0.01 });
    if (Math.random() < 0.35) tone(env, out, at + rand(0.15, 0.3), { from: 70, to: 170, sweep: 0.07, peak: level * 0.6, decay: 0.18 });
  };

/** 火竜の寝息: ゆっくり吸って、吐く。深い低音と、こもった息 */
const dragonBreath =
  (level: number): Sound =>
  (env, at) => {
    const { ctx } = env;
    const out = voice(env, { pan: rand(-0.3, 0.3), wet: 0.35 });
    const src = noiseSource(ctx, at, 9);
    const low = filterOf(ctx, "lowpass", 180, 0.6);
    low.frequency.setValueAtTime(180, at);
    low.frequency.linearRampToValueAtTime(520, at + 3.5);
    low.frequency.linearRampToValueAtTime(160, at + 8.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 3.5);
    gain.gain.linearRampToValueAtTime(0, at + 8.5);
    src.connect(low).connect(gain).connect(out);
    const osc = ctx.createOscillator();
    osc.frequency.value = 36;
    const sub = ctx.createGain();
    sub.gain.setValueAtTime(0, at);
    sub.gain.linearRampToValueAtTime(level * 0.8, at + 3.5);
    sub.gain.linearRampToValueAtTime(0, at + 8.5);
    osc.connect(sub).connect(out);
    osc.start(at);
    osc.stop(at + 8.6);
  };

/** 鐘: 唸り・短3度・5度などの、整数倍にならない倍音が長く残る */
const bell =
  (o: { note: number; level: number }): Sound =>
  (env, at) => {
    const out = voice(env, { pan: rand(-0.3, 0.3), wet: 1.3, dry: 0.35 });
    const f = 440 * 2 ** ((o.note - 69) / 12);
    const partials: [number, number, number][] = [
      [0.5, 0.4, 10],
      [1, 1, 8],
      [1.19, 0.45, 5],
      [1.5, 0.3, 4],
      [2, 0.35, 3.5],
      [2.5, 0.15, 2],
      [2.74, 0.12, 1.6],
      [4.2, 0.07, 1],
    ];
    for (const [ratio, amp, decay] of partials) tone(env, out, at, { from: f * ratio, peak: o.level * amp, decay, attack: 0.003 });
    burst(env, out, at, { type: "highpass", freq: 2000, peak: o.level * 0.3, decay: 0.006 });
  };

/** 天文盤の歯車: 木と金具が「コト、コト」と数回送られる */
const gears =
  (level: number): Sound =>
  (env, at) => {
    const out = voice(env, { wet: 0.8, dry: 0.6 });
    const count = 2 + Math.floor(Math.random() * 4);
    const gap = rand(0.7, 0.95);
    for (let i = 0; i < count; i++) {
      const t = at + i * gap;
      tone(env, out, t, { from: i % 2 ? 900 : 1100, peak: level, decay: 0.03, type: "triangle" });
      burst(env, out, t, { type: "bandpass", freq: 3000, Q: 1, peak: level * 0.5, decay: 0.006 });
    }
  };

// ---- 遠くの森から届くフクロウの声（モリフクロウ風） ----

/** 減衰していくノイズで作る、夜の森の残響（予告編でも使う） */
export function forestReverb(ctx: BaseAudioContext, destination: AudioNode) {
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

/** フクロウのひと声: 少し下がっていく丸い声と、かすかな息。tremolo を付けると震える長い声になる */
function hoot(ctx: BaseAudioContext, out: AudioNode, at: number, o: { freq: number; length: number; level: number; tremolo?: boolean }) {
  const end = at + o.length;
  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.0001, at);
  voiceGain.gain.exponentialRampToValueAtTime(o.level, at + Math.min(0.07, o.length * 0.3));
  voiceGain.gain.setValueAtTime(o.level, Math.max(at + 0.07, end - 0.16));
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, end);
  voiceGain.connect(out);

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
    osc.connect(level).connect(voiceGain);
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
  const breath = ctx.createBufferSource();
  breath.buffer = noise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = o.freq * 1.4;
  band.Q.value = 2.5;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.18;
  breath.connect(band).connect(breathLevel).connect(voiceGain);
  breath.start(at, rand(0, 3), o.length);
}

/** 「ホーー」……「ホッ、ホ、ホーーォ」。dry に素の声、wet に残響へ送る声を流す。distance は 0〜1（1 がいちばん遠く小さい）、loudness は全体の大きさ */
export function owlCall(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, at: number, distance: number, loudness = 1) {
  const out = ctx.createGain();
  const level = 0.1 * loudness * (1 - distance * 0.6);
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

const owl =
  (distance: [number, number]): Sound =>
  (env, at) =>
    // 曲の後ろで鳴らすので、予告編より小さく
    owlCall(env.ctx, env.dry, env.wet, at, rand(...distance), 0.4);

// ---------------------------------------------------------------- 場所ごとの組み合わせ

type Scene = {
  /** 響きの長さ（秒） */
  space: number;
  /** 全体の大きさ */
  level: number;
  /** 続く音 */
  beds: { label: string; make: (env: Env) => Bed }[];
  /** ときどき鳴る音: 間隔（秒）の幅と、最初に鳴るまでの幅 */
  events: { label: string; every: [number, number]; first?: [number, number]; sound: Sound }[];
};

const SCENES: Record<AmbienceKey, Scene> = {
  title: {
    space: 3.2,
    level: 1,
    beds: [],
    events: [
      { label: "遠くの虫", every: [5, 12], sound: cricket(0.006) },
      { label: "フクロウ", every: [70, 150], first: [20, 40], sound: owl([0.3, 0.8]) },
    ],
  },
  prelude: {
    space: 3,
    level: 1,
    beds: [],
    events: [{ label: "まばらな虫", every: [10, 22], sound: cricket(0.005) }],
  },
  hearth: {
    space: 1.1,
    level: 1,
    beds: [{ label: "暖炉のうなり", make: (env) => roar(env, { cutoff: 380, level: 0.022, flicker: 0.4 }) }],
    events: [
      { label: "頁をめくる音", every: [45, 100], first: [15, 40], sound: pageTurn(0.03) },
      { label: "古い床の軋み", every: [35, 80], first: [20, 50], sound: creak({ low: 140, high: 220, level: 0.012, length: [0.5, 1.1] }) },
      { label: "遠いフクロウ", every: [100, 220], first: [40, 80], sound: owl([0.75, 0.95]) },
    ],
  },
  forest: {
    space: 2.8,
    level: 1,
    beds: [],
    events: [
      { label: "虫の声", every: [5, 12], sound: cricket(0.005) },
      { label: "根を伝う水滴", every: [6, 14], sound: drip(0.012) },
      { label: "大樹の軋み", every: [30, 70], first: [10, 30], sound: creak({ low: 90, high: 150, level: 0.007, length: [0.9, 1.8] }) },
      { label: "頁をめくる音", every: [60, 140], first: [25, 60], sound: pageTurn(0.016) },
      { label: "フクロウ", every: [60, 150], first: [20, 40], sound: owl([0.3, 0.7]) },
    ],
  },
  stars: {
    space: 4,
    level: 1,
    beds: [],
    events: [
      { label: "天文盤の歯車", every: [18, 40], first: [8, 20], sound: gears(0.01) },
      { label: "天文盤の軋み", every: [30, 60], first: [15, 35], sound: creak({ low: 200, high: 320, level: 0.006, length: [0.6, 1.2] }) },
      { label: "ずっと下のフクロウ", every: [130, 260], first: [50, 90], sound: owl([0.85, 1]) },
    ],
  },
  frost: {
    space: 6,
    level: 1,
    beds: [],
    events: [{ label: "氷の粒が触れ合う音", every: [6, 15], sound: tinkle(0.009) }],
  },
  forge: {
    space: 2.2,
    level: 1,
    beds: [
      { label: "炉の低いうなり", make: (env) => roar(env, { cutoff: 220, level: 0.03, flicker: 0.25 }) },
      { label: "炉の炎のゆらぎ", make: (env) => roar(env, { cutoff: 700, level: 0.008, flicker: 0.5 }) },
    ],
    events: [
      { label: "溶岩の泡", every: [2, 6], sound: lava(0.03) },
      { label: "火竜の寝息", every: [22, 45], first: [8, 18], sound: dragonBreath(0.016) },
    ],
  },
  sanctum: {
    space: 7,
    level: 1,
    beds: [],
    // 大聖堂の鐘（曲と同じヘ長調の F）
    events: [{ label: "遠い鐘", every: [45, 100], first: [15, 35], sound: bell({ note: 53, level: 0.014 }) }],
  },
  zenith: {
    space: 6,
    level: 1,
    beds: [],
    // 遠い星の鳴る音（曲と同じロ長調の B）
    events: [
      { label: "遠い星の鳴る音", every: [50, 110], first: [20, 40], sound: bell({ note: 83, level: 0.008 }) },
      { label: "星のきらめき", every: [20, 40], sound: tinkle(0.007) },
    ],
  },
};

/** 揺らぎを予約する間隔（秒） */
const SWAY_SEC = 0.5;
const LOOKAHEAD_SEC = 6;

export type AmbienceVoice = { stop: () => void };

/** その場所の環境音を out へ流し始める。duration を渡すと、その長さぶんを先にまとめて刻む（書き出し用） */
export function startAmbience(ctx: BaseAudioContext, out: AudioNode, key: AmbienceKey, options: { duration?: number } = {}): AmbienceVoice {
  const scene = SCENES[key];
  const output = ctx.createGain();
  const start = ctx.currentTime;
  // ゆっくり立ち上げる
  output.gain.setValueAtTime(0, start);
  output.gain.linearRampToValueAtTime(scene.level, start + 4);
  output.connect(out);
  const space = ctx.createConvolver();
  space.buffer = spaceImpulse(ctx, scene.space);
  space.connect(filterOf(ctx, "lowpass", 4000)).connect(output);
  const env: Env = { ctx, dry: output, wet: space };

  const beds = scene.beds.map((b) => b.make(env));
  const events = scene.events.map((e) => ({ ...e, next: start + rand(...(e.first ?? e.every)) }));
  let nextSway = start;

  const schedule = (until: number) => {
    for (; nextSway < until; nextSway += SWAY_SEC * rand(0.6, 1.4)) for (const bed of beds) if (Math.random() < 0.35) bed.sway(nextSway);
    for (const e of events)
      for (; e.next < until; e.next += rand(...e.every)) {
        if (e.next >= ctx.currentTime) e.sound(env, e.next);
      }
  };

  const stopSources = () =>
    beds.forEach((b) =>
      b.sources.forEach((s) => {
        try {
          s.stop();
        } catch {}
      }),
    );

  if (options.duration !== undefined) {
    schedule(start + options.duration);
    for (const b of beds) for (const s of b.sources) s.stop(start + options.duration + 0.1);
    return { stop: () => output.disconnect() };
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    // 端末の休止などで大きく遅れたら、遅れた分はまとめて鳴らさず、いまから刻み直す
    const now = ctx.currentTime;
    if (nextSway < now) nextSway = now;
    for (const e of events) if (e.next < now) e.next = now + rand(0, e.every[0]);
    schedule(now + LOOKAHEAD_SEC);
    timer = setTimeout(tick, 1000);
  };
  tick();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stopSources();
      output.disconnect();
    },
  };
}

// ---------------------------------------------------------------- 1つずつ聴く（試聴ページ用）

/** その場所で使っている音の一覧（続く音が先、ときどき鳴る音が後） */
export function ambienceParts(key: AmbienceKey) {
  const scene = SCENES[key];
  return [...scene.beds.map((b) => ({ label: b.label, kind: "bed" as const })), ...scene.events.map((e) => ({ label: e.label, kind: "event" as const }))];
}

/** 続く音を1つずつ聴くときに流す長さ（秒） */
const BED_PREVIEW_SEC = 8;

/**
 * ambienceParts の index 番目の音を1回だけ鳴らす（続く音は8秒流して消す）。曲の後ろ用にとても小さく作ってあるので、
 * boost 倍に持ち上げて鳴らす。戻り値で途中で止める
 */
export function playAmbiencePart(ctx: BaseAudioContext, out: AudioNode, key: AmbienceKey, index: number, boost = 6) {
  const scene = SCENES[key];
  const output = ctx.createGain();
  output.gain.value = boost;
  output.connect(out);
  const space = ctx.createConvolver();
  space.buffer = spaceImpulse(ctx, scene.space);
  space.connect(filterOf(ctx, "lowpass", 4000)).connect(output);
  const env: Env = { ctx, dry: output, wet: space };
  const at = ctx.currentTime + 0.05;
  const stop = () => output.disconnect();

  if (index < scene.beds.length) {
    const bed = scene.beds[index].make(env);
    for (let t = 0; t < BED_PREVIEW_SEC; t += SWAY_SEC) bed.sway(at + t);
    output.gain.setValueAtTime(0, at);
    output.gain.linearRampToValueAtTime(boost, at + 1);
    output.gain.setValueAtTime(boost, at + BED_PREVIEW_SEC - 1.5);
    output.gain.linearRampToValueAtTime(0, at + BED_PREVIEW_SEC);
    for (const s of bed.sources) s.stop(at + BED_PREVIEW_SEC + 0.1);
    return () => {
      for (const s of bed.sources)
        try {
          s.stop();
        } catch {}
      stop();
    };
  }
  scene.events[index - scene.beds.length]?.sound(env, at);
  return stop;
}
