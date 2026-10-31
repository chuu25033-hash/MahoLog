// 音声ファイルが無いときに Web Audio API で組み立てる環境音・効果音。
// 音の軸は詠唱開始音（低くから昇る光と、ゆっくり開く和音）。すべて低音〜中音域に寄せ、柔らかい残響で包む。
// 環境音（BGM）はノイズを使わず、柔らかいピアノとオルゴールの静かなコード進行で作る。
// タイトルとステージごとに調と進行を変える。
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

/**
 * 滞在する地ごとの曲。タイトルと同じピアノとオルゴールで、調と和音進行を変え、
 * 少しゆっくり・控えめに奏でる。オルゴールはタイトルより1オクターブ低く、高域も丸めて落ち着かせる
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

const SOUNDSCAPES: Record<Exclude<AmbienceKey, "title">, { chords: Chord[] }> = {
  // 旅立ちの前（星天の導き）: C の明るい進行 Cmaj7 → Am7 → Fmaj7 → G6
  prelude: { chords: [ch(36, [55, 59, 64]), ch(33, [55, 60, 64]), ch(41, [57, 60, 64]), ch(43, [59, 62, 64])] },
  // 小屋: G の温かな下行 Cmaj7 → Bm7 → Am7 → Gmaj7
  hearth: { chords: [ch(36, [55, 59, 64]), ch(35, [54, 57, 62]), ch(33, [55, 60, 64]), ch(31, [54, 59, 62])] },
  // 樹海・図書室: D の深い響き Dm9 → B♭maj7 → Fmaj7 → C(add9)
  forest: { chords: [ch(38, [57, 60, 64]), ch(34, [57, 62, 65]), ch(41, [57, 60, 64]), ch(36, [55, 62, 64])] },
  // 観測塔・星空: E の澄んだ下行 Amaj7 → G♯m7 → F♯m7 → Emaj7
  stars: { chords: [ch(45, [61, 64, 68]), ch(44, [59, 63, 66]), ch(42, [57, 61, 64]), ch(40, [59, 63, 68])] },
  // 氷の回廊: B マイナーの静けさ Gmaj7 → F♯m7 → Em7 → Bm(add9)
  frost: { chords: [ch(43, [59, 62, 66]), ch(42, [57, 61, 64]), ch(40, [59, 62, 67]), ch(35, [59, 61, 62])] },
  // 魔導炉: E マイナーの重み Cmaj7 → Am7 → Bm7 → Em7
  forge: { chords: [ch(36, [55, 59, 64]), ch(33, [55, 60, 64]), ch(35, [54, 57, 62]), ch(40, [55, 59, 62])] },
  // 大聖堂: F の荘厳な進行 B♭maj7 → C6 → Am7 → Dm7
  sanctum: { chords: [ch(34, [57, 62, 65]), ch(36, [57, 60, 64]), ch(33, [55, 60, 64]), ch(38, [57, 60, 65])] },
};

function soundscape(ctx: AudioContext, out: AudioNode, layer: Layer, key: Exclude<AmbienceKey, "title">) {
  const s = SOUNDSCAPES[key];
  pianoPiece(ctx, out, layer, { ...STAGE_PIECE, chords: s.chords });
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
