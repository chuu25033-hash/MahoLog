// アプリ全体の音を司る。音の流れ: 環境音 → [ダッキング] → BGMバス ─┐
//                                                 効果音 → SEバス ─┴→ マスター → 出力
// ブラウザの自動再生制限があるため、AudioContext は最初の操作（タップ・キー入力）で起こす。
// 別のタブを見ている間も環境音は流し続け、ブラウザに止められたら起こし直す（keepAlive）。
import { SOUND_FILES, type AmbienceKey, type SeKey } from "./sound-files";
import { synthAmbience, synthSe, type Voice } from "./synth";

/** 環境音の切り替え（フェードアウト ➔ フェードイン）にかける秒数 */
const CROSSFADE_SEC = 2.5;
/**
 * 詠唱中の環境音: 音量を抑えて集中を妨げないようにする。
 * 高域は落としすぎない（こもった音は眠気を誘い、旋律の輪郭も消えるため、オルゴールの芯が残る程度にとどめる）
 */
const DUCK_GAIN = 0.55;
const DUCK_CUTOFF = 3600;
/** 環境音の基準の大きさ。音量スライダー 100% でもこの割合までにとどめ、集中を邪魔しない微かな背景音にする */
const AMBIENCE_LEVEL = 0.45;
/** 結果の演出（魔力の蓄積・吸入・記憶の解放）の音量。環境音を覆わないよう、効果音の音量のこの割合で鳴らす */
const CUE_LEVEL = 0.5;
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
  /** 演出の効果音を控えめに鳴らす経路（cue → se） */
  cue: GainNode;
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
  private silenced = false;
  /** ページを離れるときに音を消して止めた後か（pagehide） */
  private hushed = false;
  /** 一度でも音を起こせたか。起こせた後は、ブラウザに止められても操作を待たずに起こし直せる */
  private unlocked = false;
  private ambienceKey: AmbienceKey | null = null;
  /** 静息の間は、滞在中の環境音に代えて静息の曲を流す */
  private restMusic = false;
  private current: { key: AmbienceKey; voice: Voice } | null = null;
  private ambienceGen = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lastCueAt = 0;
  /** 開発中に読み直されて、新しいものに役目を譲った後か */
  private disposed = false;

  /** 鳴らしている曲を止め、AudioContext を閉じる（開発中にこのファイルが読み直されたとき、古いものが鳴り続けないように） */
  dispose() {
    this.disposed = true;
    this.ambienceGen += 1;
    this.current?.voice.stop();
    this.current = null;
    void this.bus?.ctx.close().catch(() => undefined);
    this.bus = null;
  }

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

  /** 静息の間だけ、静息の曲に替える（明けたら滞在中の環境音へクロスフェードで戻す） */
  setRestMusic(on: boolean) {
    if (this.restMusic === on) return;
    this.restMusic = on;
    void this.syncAmbience();
  }

  /**
   * 操作を待たずに鳴らせるか試す（ブラウザが自動再生を許していれば、そのまま環境音が流れ始める）。
   * 許されていなければ、最初の操作で鳴り始める
   */
  tryStart() {
    const bus = this.ensureBus();
    if (bus?.ctx.state === "running") void this.syncAmbience();
  }

  /** プロローグなど、効果音だけで聴かせる演出の間は環境音を消す */
  setSilenced(silenced: boolean) {
    if (this.silenced === silenced) return;
    this.silenced = silenced;
    void this.syncAmbience();
  }

  /** 音を鳴らせる状態か（ブラウザの自動再生制限が解けているか） */
  isAwake() {
    return this.ensureBus()?.ctx.state === "running";
  }

  /** 操作の中で呼び、音を起こす */
  async wake() {
    const bus = this.ensureBus();
    if (!bus) return;
    if (bus.ctx.state !== "running") await bus.ctx.resume().catch(() => undefined);
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
    const bus = this.ensureBus();
    if (bus) this.play(key, bus.se);
  }

  /** 結果: 授かった魔力が数え上がる */
  playMannaCharge() {
    this.playCue("mannaCharge");
  }

  /** 結果: 魔力の粒子が魔法陣（星脈）へ吸い込まれる */
  playMannaAbsorb() {
    this.playCue("mannaAbsorb");
  }

  /** 結果: 流れ星がほどけ、観測した品が現れる。秘宝以上が混じれば、今までどおり深い鐘（dropRare）を控えめにせず鳴らす */
  playMemoryUnlock(rare = false) {
    if (rare) this.playCue("dropRare", false);
    else this.playCue("memoryUnlock");
  }

  /**
   * 結果の演出の効果音: 控えめな音量（CUE_LEVEL）で鳴らす。
   * 画面が裏に回っているとき・音が止められているときは鳴らさない（起こし直した瞬間にまとめて鳴り出さないように）
   */
  private playCue(key: SeKey, soft = true) {
    if (typeof document !== "undefined" && document.hidden) return;
    const bus = this.ensureBus();
    if (!bus || bus.ctx.state !== "running") return;
    this.play(key, soft ? bus.cue : bus.se);
  }

  private play(key: SeKey, out: AudioNode) {
    if (key !== "tap") this.lastCueAt = performance.now();
    else if (performance.now() - this.lastCueAt < TAP_SUPPRESS_MS) return;
    if (!this.enabled || this.volumes.se <= 0) return;
    const bus = this.bus;
    if (!bus) return;
    const file = SOUND_FILES.se[key];
    if (!file) {
      synthSe(bus.ctx, key, out);
      return;
    }
    void this.loadBuffer(file).then((buffer) => {
      if (!buffer) return synthSe(bus.ctx, key, out);
      const src = bus.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(out);
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
    // 押せる要素かは押した時点で見る（押すと無効になるボタンもある）。
    // 鳴らすのは各ハンドラの後にして、詠唱開始などの効果音を鳴らした操作ではタップ音を重ねない
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.(TAP_TARGET);
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      setTimeout(() => this.playSe("tap"), 0);
    };
    // 別のタブへ移っても環境音は流し続ける（単語帳や資料を見ながらでも途切れない）。
    // 隠れた・戻った・履歴から戻った・窓に戻ったときに、ブラウザが止めていれば起こし直す
    const keepAlive = () => void this.keepAlive();
    // 閉じる・別のページへ移るときは、音を消してから止める。
    // スマホでは鳴らしたまま画面が凍ると、最後の一瞬の音が繰り返されて「ビー」と鳴り続けることがある
    const hush = () => this.hush();
    const onShow = () => void this.keepAlive(true);
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", keepAlive);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("pagehide", hush);
    window.addEventListener("focus", keepAlive);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", keepAlive);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("pagehide", hush);
      window.removeEventListener("focus", keepAlive);
    };
  }

  /**
   * 止められた AudioContext を起こし直す。
   * suspended: 省電力などでブラウザが止めた / interrupted: iOS Safari で電話・他のアプリの音に割り込まれた。
   * 音を起こせたことのある場合だけ試す（自動再生の制限が解けていない間は、最初の操作を待つ）
   */
  private async keepAlive(returned = false) {
    const bus = this.bus;
    if (!bus || !this.unlocked || !this.enabled) return;
    // 画面が隠れている間にブラウザが止めたのなら、起こし直さない（パソコンのブラウザは隠れても止めないので、
    // 止めるのはスマホが裏へ回したとき。そこで起こすと止める・起こすがぶつかり、音が途切れて雑音になる）。戻ったときに起こす
    if (typeof document !== "undefined" && document.hidden) return;
    // 離れるときに止めたものは、ページに戻ってきた（pageshow）ときだけ起こす
    if (this.hushed && !returned) return;
    if (bus.ctx.state !== "running" && bus.ctx.state !== "closed") {
      await bus.ctx.resume().catch(() => undefined);
    }
    void this.syncAmbience();
  }

  /** 音をすぐに消して止める（閉じる・ページを離れるとき）。戻ってきたら keepAlive で音量を戻す */
  private hush() {
    const bus = this.bus;
    if (!bus || bus.ctx.state === "closed") return;
    this.hushed = true;
    const gain = bus.master.gain;
    gain.cancelScheduledValues(bus.ctx.currentTime);
    gain.setTargetAtTime(0, bus.ctx.currentTime, 0.005);
    void bus.ctx.suspend().catch(() => undefined);
  }

  private ensureBus(): Bus | null {
    if (this.disposed) return null;
    if (this.bus) return this.bus;
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
    try {
      // 音を作る区切りを大きめにとる（曲の切り替わりで2曲ぶんの残響が重なっても、描き遅れて「ザザッ」と途切れないように）
      const ctx = new AudioContext({ latencyHint: "playback" });
      const master = ctx.createGain();
      // 最後の守り: 曲の重なりや効果音が重なって 0dB を超え、音割れするのを抑える
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      const bgm = ctx.createGain();
      const se = ctx.createGain();
      const cue = ctx.createGain();
      cue.gain.value = CUE_LEVEL;
      cue.connect(se);
      const duck = ctx.createGain();
      const duckFilter = ctx.createBiquadFilter();
      duckFilter.type = "lowpass";
      duckFilter.frequency.value = this.ducked ? DUCK_CUTOFF : 20000;
      duck.gain.value = this.ducked ? DUCK_GAIN : 1;
      duck.connect(duckFilter).connect(bgm).connect(master);
      se.connect(master);
      master.connect(limiter).connect(ctx.destination);
      // 動き出したら起こせた印を付け、ブラウザに止められたら（割り込みが明けたときも含めて）起こし直す
      ctx.addEventListener("statechange", () => {
        if (ctx.state === "running") {
          this.unlocked = true;
          // 離れるときに消した音量を戻す（戻ってきた・タップしたなど、どの道で起きても）
          if (this.hushed) {
            this.hushed = false;
            this.applyVolumes();
          }
        } else void this.keepAlive();
      });
      if (ctx.state === "running") this.unlocked = true;
      this.bus = { ctx, master, bgm, se, cue, duck, duckFilter };
      this.applyVolumes(true);
      this.preloadSe();
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
    set(bus.bgm.gain, this.volumes.bgm * AMBIENCE_LEVEL);
    set(bus.se.gain, this.volumes.se);
  }

  private async syncAmbience() {
    const bus = this.bus;
    if (!bus || bus.ctx.state !== "running") return;
    const want = this.enabled && !this.silenced ? (this.restMusic && this.ambienceKey ? "rest" : this.ambienceKey) : null;
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

  /** 登録した効果音のファイルを先に読み込んでおき、初めて鳴らすときの遅れを無くす */
  private preloadSe() {
    for (const file of Object.values(SOUND_FILES.se)) if (file) void this.loadBuffer(file);
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

// 開発中のホットリロードでこのファイルが読み直されると、新しい soundManager が作られる。
// 前のものを止めておかないと、その曲が誰にも止められずに鳴り続け、新しい曲と二重に流れる
const registry = globalThis as typeof globalThis & { __maholog_sound_manager?: SoundManager };
registry.__maholog_sound_manager?.dispose();
export const soundManager = new SoundManager();
registry.__maholog_sound_manager = soundManager;
