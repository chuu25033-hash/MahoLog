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

// ---------------------------------------------------------------- 描いて鳴らす音
// 頁・軋み・歯車・火竜の寝息は、発振器を揺らすだけでは作り物に聞こえるので、音が生まれる仕組みに沿って
// 波形を JS で一度だけ描く（場所ごとに数通り描いておき、鳴るたびに選ぶ）

/** 2次の IIR フィルター（RBJ の式）。set で途中から高さを変えられる */
function biquad(type: "lowpass" | "highpass" | "bandpass", freq: number, q: number, sr: number) {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (f: number, qq = q) => {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const alpha = Math.sin(w) / (2 * qq);
    const cos = Math.cos(w);
    const a0 = 1 + alpha;
    if (type === "lowpass") [b0, b1, b2] = [(1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0];
    else if (type === "highpass") [b0, b1, b2] = [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0];
    else [b0, b1, b2] = [alpha / a0, 0, -alpha / a0];
    [a1, a2] = [(-2 * cos) / a0, (1 - alpha) / a0];
  };
  set(freq);
  return {
    set,
    run(x: number) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      [x2, x1, y2, y1] = [x1, x, y1, y];
      return y;
    },
  };
}

const white = () => Math.random() * 2 - 1;

/** 左右2本の波形をいちばん大きいところで 1 にそろえて、AudioBuffer にする */
function toBuffer(ctx: BaseAudioContext, channels: Float32Array[]) {
  let peak = 0;
  for (const ch of channels) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const buffer = ctx.createBuffer(channels.length, channels[0].length, ctx.sampleRate);
  channels.forEach((ch, c) => {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) data[i] = ch[i] / (peak || 1);
  });
  return buffer;
}

/** 左右の位置を from から to へ動かしながら、1本の波形を2本に分ける */
function spread(mono: Float32Array, from: number, to: number) {
  const left = new Float32Array(mono.length);
  const right = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    const pan = from + ((to - from) * i) / mono.length;
    left[i] = mono[i] * Math.cos(((pan + 1) * Math.PI) / 4);
    right[i] = mono[i] * Math.sin(((pan + 1) * Math.PI) / 4);
  }
  return [left, right];
}

const drawnCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer[]>>();
/** 描いた音を name ごとに count 通りまで覚えておき、その中から1つ選ぶ */
function drawn(ctx: BaseAudioContext, name: string, draw: (sr: number) => Float32Array[], count = 4) {
  let cache = drawnCache.get(ctx);
  if (!cache) drawnCache.set(ctx, (cache = new Map()));
  let list = cache.get(name);
  if (!list) cache.set(name, (list = []));
  if (list.length < count) list.push(toBuffer(ctx, draw(ctx.sampleRate)));
  return list[Math.floor(Math.random() * list.length)];
}

function playDrawn(env: Env, buffer: AudioBuffer, at: number, o: { level: number; wet: number; dry?: number; pan?: number }) {
  const src = env.ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rand(0.96, 1.04);
  const gain = env.ctx.createGain();
  gain.gain.value = o.level;
  src.connect(gain).connect(voice(env, { wet: o.wet, dry: o.dry, pan: o.pan ?? rand(-0.4, 0.4) }));
  src.start(at);
}

/**
 * 頁をめくる: 紙がしなって動く空気の音（帯域が持ち上がってから下りる）に、紙の繊維が擦れる細かな音を重ね、
 * 最後に頁がそっと落ちる。めくる手の動きに合わせて、左から右へ流れる
 */
function drawPage(sr: number) {
  const length = rand(0.55, 0.85);
  const n = Math.floor(sr * (length + 0.12));
  const mono = new Float32Array(n);
  const air = biquad("bandpass", 1400, 0.9, sr);
  const fiber = biquad("highpass", 2500, 0.7, sr);
  const flapTone = biquad("lowpass", 900, 0.7, sr);
  let click = 0;
  const flapAt = length - 0.03;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const p = Math.min(1, t / length);
    if (i % 32 === 0) air.set(p < 0.4 ? 1400 + 2400 * (p / 0.4) : 3800 - 1600 * ((p - 0.4) / 0.6));
    // めくり始めはゆっくりふくらみ、終わりで消える
    const env = t > length ? 0 : p < 0.15 ? (p / 0.15) ** 0.7 : p > 0.75 ? (1 - p) / 0.25 : 1;
    // 紙の繊維の擦れ: 1秒に数百回の小さな音が、動きの強いところほど多く鳴る
    if (Math.random() < (700 * env) / sr) click = rand(0.3, 1);
    click *= Math.exp(-1 / (0.0004 * sr));
    let s = air.run(white()) * env * 0.6 + fiber.run(click * white()) * 0.9;
    if (t >= flapAt) {
      const u = t - flapAt;
      s += Math.sin(2 * Math.PI * 120 * u) * Math.exp(-u / 0.025) * 0.35 + flapTone.run(white()) * Math.exp(-u / 0.012) * 0.4;
    }
    mono[i] = s;
  }
  const from = rand(-0.5, -0.1);
  return spread(mono, from, from + rand(0.4, 0.7));
}

type CreakKind = "floor" | "tree" | "metal";

/** 軋みの素材: 引っかかって滑る回数（1秒あたり）、長さ、鳴る板や幹の響き（高さと鋭さ） */
const CREAK: Record<CreakKind, { rate: [number, number]; length: [number, number]; bodies: () => [number, number, number][] }> = {
  // 古い床板: 乾いた中音
  floor: { rate: [55, 110], length: [0.7, 1.3], bodies: () => [[rand(380, 520), 9, 1], [rand(900, 1200), 12, 0.6], [rand(2000, 2600), 10, 0.3]] },
  // 大樹: 低く長いうめき
  tree: { rate: [22, 48], length: [1.6, 2.6], bodies: () => [[rand(170, 240), 7, 1], [rand(420, 560), 9, 0.7], [rand(1000, 1300), 8, 0.35]] },
  // 天文盤の軸: 金属の硬く高い鳴り
  metal: { rate: [130, 240], length: [0.6, 1.1], bodies: () => [[rand(1100, 1400), 25, 1], [rand(2600, 3100), 30, 0.6], [rand(5200, 6000), 30, 0.3]] },
};

/**
 * 軋み: 引っかかっては滑る小さな衝撃が、板や幹（あるいは金具）を鳴らす。滑る速さが揺れて音の高さがうねり、
 * 力のかかり方で強弱がつく
 */
function drawCreak(kind: CreakKind) {
  return (sr: number) => {
    const c = CREAK[kind];
    const length = rand(...c.length);
    const n = Math.floor(sr * (length + 0.25));
    const mono = new Float32Array(n);
    const specs = c.bodies();
    const bodies = specs.map(([f, q, mix]) => ({ filter: biquad("bandpass", f, q, sr), mix }));
    // 擦れる面のかすかなざらつき
    const friction = biquad("bandpass", specs[0][0], 2, sr);
    const tone = biquad("lowpass", kind === "metal" ? 8000 : 4500, 0.7, sr);
    const base = rand(...c.rate);
    const bend = rand(0.6, 1.4);
    const phase0 = rand(0, Math.PI * 2);
    let wander = 1;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const p = t / length;
      const env = p >= 1 ? 0 : Math.sin(Math.PI * p) ** 0.6 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 3 * t));
      wander += (rand(-1, 1) * 0.002 - (wander - 1) * 0.0005);
      const rate = base * wander * (1 + 0.35 * Math.sin(2 * Math.PI * bend * p + phase0));
      phase += rate / sr;
      let excite = 0;
      if (phase >= 1) {
        phase -= 1;
        excite = env * rand(0.6, 1);
      }
      let s = 0;
      for (const b of bodies) s += b.filter.run(excite) * b.mix;
      mono[i] = tone.run(s + friction.run(white()) * env * 0.015);
    }
    const pan = rand(-0.5, 0.5);
    return spread(mono, pan, pan);
  };
}

/**
 * 天文盤の歯車: 脱進機が「チッ、コッ」と金属の音を交互に刻み、最後に大きな盤が「ゴトン」と一目盛り動いて、
 * 歯車の列が細かく回る。金属は高く鋭い響き、盤は木の低い響きで鳴る
 */
function drawGears(sr: number) {
  const ticks = 3 + Math.floor(Math.random() * 4);
  const gap = rand(0.42, 0.6);
  const moveAt = ticks * gap + 0.1;
  const n = Math.floor(sr * (moveAt + 1.2));
  const tick = new Float32Array(n);
  const tock = new Float32Array(n);
  const low = new Float32Array(n);
  const burst = (target: Float32Array, at: number, amp: number) => {
    const start = Math.floor(at * sr);
    for (let i = 0; i < sr * 0.003 && start + i < n; i++) target[start + i] += amp * white() * Math.exp(-i / (sr * 0.0008));
  };
  for (let k = 0; k < ticks; k++) burst(k % 2 ? tock : tick, k * gap + rand(-0.01, 0.01), rand(0.8, 1));
  burst(low, moveAt, 1);
  // 歯車の列が回る細かな音
  const whirr = 8 + Math.floor(Math.random() * 7);
  for (let k = 0; k < whirr; k++) burst(k % 2 ? tock : tick, moveAt + 0.05 + k / 35, 0.3 * (1 - k / whirr));
  const bank = (freqs: number[], qs: number[], mix: number[]) => freqs.map((f, i) => ({ filter: biquad("bandpass", f, qs[i], sr), mix: mix[i] }));
  const scale = rand(0.9, 1.1);
  const metalA = bank([2150, 3420, 5630, 7900].map((f) => f * scale), [40, 50, 45, 35], [1, 0.7, 0.5, 0.3]);
  const metalB = bank([2150, 3420, 5630, 7900].map((f) => f * scale * 0.86), [40, 50, 45, 35], [1, 0.7, 0.5, 0.3]);
  const wood = bank([95, 620, 1480], [3, 18, 20], [1.4, 0.8, 0.4]);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const b of metalA) s += b.filter.run(tick[i]) * b.mix;
    for (const b of metalB) s += b.filter.run(tock[i]) * b.mix;
    for (const b of wood) s += b.filter.run(low[i]) * b.mix;
    mono[i] = s;
  }
  const pan = rand(-0.3, 0.3);
  return spread(mono, pan, pan);
}

/**
 * 火竜の寝息: 喉を通る空気が持ち上がりながら吸い込まれ、少し止まって、低いうなりと息の震え（喉が細かく震える）を
 * 伴いながら長く吐き出される。左右をわずかにずらして、大きな体の広がりを出す
 */
function drawDragon(sr: number) {
  const inhale = rand(2.6, 3.4);
  const hold = rand(0.3, 0.6);
  const exhale = rand(4.5, 5.8);
  const total = inhale + hold + exhale + 0.5;
  const n = Math.floor(sr * total);
  const mono = new Float32Array(n);
  const throat = biquad("bandpass", 500, 1.2, sr);
  const hiss = biquad("highpass", 2500, 0.7, sr);
  const breath = biquad("lowpass", 450, 0.7, sr);
  const chest = biquad("bandpass", 300, 3, sr);
  const growlHz = rand(32, 40);
  let fry = 0;
  let nextPulse = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    if (t < inhale) {
      const p = t / inhale;
      if (i % 32 === 0) throat.set(500 + 500 * p);
      const env = p ** 1.5 * (p > 0.92 ? (1 - p) / 0.08 : 1);
      s = throat.run(white()) * env * 0.8 + hiss.run(white()) * env * 0.12;
    } else if (t > inhale + hold) {
      const u = t - inhale - hold;
      const p = u / exhale;
      if (i % 32 === 0) breath.set(450 - 200 * Math.min(1, p));
      const env = p >= 1 ? 0 : Math.min(1, u / 0.4) * (1 - p) ** 1.2;
      // 喉の震え: 1秒に二十数回の細かなかすれ
      if (t >= nextPulse) {
        fry = 1;
        nextPulse = t + 1 / rand(22, 32);
      }
      fry *= Math.exp(-1 / (0.008 * sr));
      const noise = white();
      s =
        breath.run(noise) * env * (0.55 + 0.45 * fry) +
        chest.run(noise * fry) * env * 0.5 +
        Math.sin(2 * Math.PI * growlHz * u + 0.4 * Math.sin(2 * Math.PI * 0.7 * u)) * env * 0.35;
    }
    mono[i] = s;
  }
  const left = mono;
  const right = new Float32Array(n);
  const lag = Math.floor(sr * 0.0004);
  for (let i = lag; i < n; i++) right[i] = mono[i - lag];
  return [left, right];
}

/** 頁をめくる音 */
const pageTurn =
  (level: number): Sound =>
  (env, at) =>
    playDrawn(env, drawn(env.ctx, "page", drawPage), at, { level, wet: 0.3 });

/** 軋み（古い床板・大樹・天文盤の軸） */
const creak =
  (kind: CreakKind, level: number): Sound =>
  (env, at) =>
    playDrawn(env, drawn(env.ctx, `creak-${kind}`, drawCreak(kind)), at, { level, wet: kind === "tree" ? 0.6 : 0.45 });

/** 天文盤の歯車 */
const gears =
  (level: number): Sound =>
  (env, at) =>
    playDrawn(env, drawn(env.ctx, "gears", drawGears), at, { level, wet: 0.8, dry: 0.6 });

/** 火竜の寝息（長いので2通りまで） */
const dragonBreath =
  (level: number): Sound =>
  (env, at) =>
    playDrawn(env, drawn(env.ctx, "dragon", drawDragon, 2), at, { level, wet: 0.35, pan: rand(-0.2, 0.2) });

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
      { label: "古い床の軋み", every: [35, 80], first: [20, 50], sound: creak("floor", 0.03) },
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
      { label: "大樹の軋み", every: [30, 70], first: [10, 30], sound: creak("tree", 0.055) },
      { label: "頁をめくる音", every: [60, 140], first: [25, 60], sound: pageTurn(0.016) },
      { label: "フクロウ", every: [60, 150], first: [20, 40], sound: owl([0.3, 0.7]) },
    ],
  },
  stars: {
    space: 4,
    level: 1,
    beds: [],
    events: [
      { label: "天文盤の歯車", every: [18, 40], first: [8, 20], sound: gears(0.06) },
      { label: "天文盤の軋み", every: [30, 60], first: [15, 35], sound: creak("metal", 0.025) },
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
      { label: "火竜の寝息", every: [22, 45], first: [8, 18], sound: dragonBreath(0.02) },
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
