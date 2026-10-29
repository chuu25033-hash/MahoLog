// アプリ全体の音を司る。音の流れ: 環境音 → [ダッキング] → BGMバス ─┐
//                                                 効果音 → SEバス ─┴→ マスター → 出力
// ブラウザの自動再生制限があるため、AudioContext は最初の操作（タップ・キー入力）で起こす。
import { SOUND_FILES, type AmbienceKey, type SeKey } from "./sound-files";
import { synthAmbience, synthSe, type Voice } from "./synth";

/** 環境音の切り替え（フェードアウト ➔ フェードイン）にかける秒数 */
const CROSSFADE_SEC = 2.5;
/** 詠唱中の環境音: 音量を抑え、高域を落として集中を妨げないようにする */
const DUCK_GAIN = 0.45;
const DUCK_CUTOFF = 1800;
/** 他の効果音を鳴らした直後のタップ音は重ねない */
const TAP_SUPPRESS_MS = 120;
/** タップ音を鳴らす要素 */
const TAP_TARGET = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"]';

export type SoundVolumes = { master: number; bgm: number; se: number };

type Bus = {
  ctx: AudioContext;
  master: GainNode;
  bgm: GainNode;
  se: GainNode;
  duck: GainNode;
  duckFilter: BiquadFilterNode;
};

function ramp(param: AudioParam, value: number, ctx: AudioContext, timeConstant = 0.15) {
  param.cancelScheduledValues(ctx.currentTime);
  param.setTargetAtTime(value, ctx.currentTime, timeConstant);
}

class SoundManager {
  private bus: Bus | null = null;
  private enabled = true;
  private volumes: SoundVolumes = { master: 1, bgm: 0.5, se: 0.7 };
  private ducked = false;
  private hidden = false;
  private ambienceKey: AmbienceKey | null = null;
  private current: { key: AmbienceKey; voice: Voice } | null = null;
  private ambienceGen = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lastCueAt = 0;

  /** 音声全般の ON / OFF */
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.applyVolumes();
    void this.syncAmbience();
  }

  setVolumes(volumes: Partial<SoundVolumes>) {
    this.volumes = { ...this.volumes, ...volumes };
    this.applyVolumes();
  }

  /** 滞在中の環境音。変わったときだけクロスフェードで切り替える */
  setAmbience(key: AmbienceKey | null) {
    if (this.ambienceKey === key) return;
    this.ambienceKey = key;
    void this.syncAmbience();
  }

  /** 詠唱中は環境音を控えめにする */
  setDucked(ducked: boolean) {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    const bus = this.bus;
    if (!bus) return;
    ramp(bus.duck.gain, ducked ? DUCK_GAIN : 1, bus.ctx, 0.6);
    ramp(bus.duckFilter.frequency, ducked ? DUCK_CUTOFF : 20000, bus.ctx, 0.6);
  }

  /** 効果音を鳴らす */
  playSe(key: SeKey) {
    if (key !== "tap") this.lastCueAt = performance.now();
    else if (performance.now() - this.lastCueAt < TAP_SUPPRESS_MS) return;
    if (!this.enabled || this.volumes.se <= 0) return;
    const bus = this.ensureBus();
    if (!bus) return;
    const file = SOUND_FILES.se[key];
    if (!file) {
      synthSe(bus.ctx, key, bus.se);
      return;
    }
    void this.loadBuffer(file).then((buffer) => {
      if (!buffer) return synthSe(bus.ctx, key, bus.se);
      const src = bus.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(bus.se);
      src.start();
    });
  }

  /**
   * 画面全体の操作を見張る: 最初の操作で音を起こし、ボタン・リンク・カードのタップに効果音を添える。
   * 戻り値で見張りを外す
   */
  attach() {
    const unlock = () => {
      const bus = this.ensureBus();
      if (!bus) return;
      if (bus.ctx.state === "running") void this.syncAmbience();
      else void bus.ctx.resume().then(() => this.syncAmbience());
    };
    // React のハンドラより後に走るので、詠唱開始などの効果音を鳴らした操作ではタップ音が重ならない
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.(TAP_TARGET);
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      this.playSe("tap");
    };
    // 画面が隠れている間は環境音を絞る（完了の報せは鳴らせるよう、音そのものは止めない）
    const onVisibility = () => {
      this.hidden = document.hidden;
      this.applyVolumes();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  private ensureBus(): Bus | null {
    if (this.bus) return this.bus;
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      const bgm = ctx.createGain();
      const se = ctx.createGain();
      const duck = ctx.createGain();
      const duckFilter = ctx.createBiquadFilter();
      duckFilter.type = "lowpass";
      duckFilter.frequency.value = this.ducked ? DUCK_CUTOFF : 20000;
      duck.gain.value = this.ducked ? DUCK_GAIN : 1;
      duck.connect(duckFilter).connect(bgm).connect(master);
      se.connect(master);
      master.connect(ctx.destination);
      this.bus = { ctx, master, bgm, se, duck, duckFilter };
      this.applyVolumes(true);
      return this.bus;
    } catch {
      return null;
    }
  }

  private applyVolumes(immediate = false) {
    const bus = this.bus;
    if (!bus) return;
    const set = (param: AudioParam, value: number) => (immediate ? (param.value = value) : ramp(param, value, bus.ctx));
    set(bus.master.gain, this.enabled ? this.volumes.master : 0);
    set(bus.bgm.gain, this.hidden ? 0 : this.volumes.bgm);
    set(bus.se.gain, this.volumes.se);
  }

  private async syncAmbience() {
    const bus = this.bus;
    if (!bus || bus.ctx.state !== "running") return;
    const want = this.enabled ? this.ambienceKey : null;
    if ((this.current?.key ?? null) === want) return;
    const gen = ++this.ambienceGen;

    const old = this.current;
    this.current = null;
    if (old) {
      const gain = old.voice.output.gain;
      gain.cancelScheduledValues(bus.ctx.currentTime);
      gain.setValueAtTime(gain.value, bus.ctx.currentTime);
      gain.linearRampToValueAtTime(0, bus.ctx.currentTime + CROSSFADE_SEC);
      setTimeout(() => old.voice.stop(), CROSSFADE_SEC * 1000 + 200);
    }
    if (!want) return;

    const voice = await this.ambienceVoice(bus, want);
    if (gen !== this.ambienceGen) {
      voice.stop();
      return;
    }
    this.current = { key: want, voice };
    const t = bus.ctx.currentTime;
    voice.output.gain.setValueAtTime(0, t);
    // 前の音が消えかけてから立ち上がるよう、少し遅らせて重ねる
    voice.output.gain.linearRampToValueAtTime(0, t + (old ? CROSSFADE_SEC * 0.4 : 0));
    voice.output.gain.linearRampToValueAtTime(1, t + (old ? CROSSFADE_SEC * 1.4 : CROSSFADE_SEC));
  }

  /** 環境音の声部: 登録した音声ファイルをループ再生し、無ければ生成音で代える */
  private async ambienceVoice(bus: Bus, key: AmbienceKey): Promise<Voice> {
    const file = SOUND_FILES.ambience[key];
    const buffer = file ? await this.loadBuffer(file) : null;
    if (!buffer) return synthAmbience(bus.ctx, key, bus.duck);
    const output = bus.ctx.createGain();
    output.gain.value = 0;
    output.connect(bus.duck);
    const src = bus.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(output);
    src.start();
    return {
      output,
      stop: () => {
        src.stop();
        output.disconnect();
      },
    };
  }

  /** 音声ファイルを読み込む（失敗したら null。結果は覚えておく） */
  private loadBuffer(url: string) {
    let pending = this.buffers.get(url);
    if (!pending) {
      const ctx = this.bus!.ctx;
      pending = fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status}`))))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null);
      this.buffers.set(url, pending);
    }
    return pending;
  }
}

export const soundManager = new SoundManager();
