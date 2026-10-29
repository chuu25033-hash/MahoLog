// 結びし世界線: 世界線ID（LN-XXXXXX）で結ばれた相手の「気配」だけを観測する。
// 順位・数値の比較は持たず、詠唱中か・最後の探求・滞在エリアのみを扱う。
import { AREAS, findArea, stageOfArea } from "./areas";

/** 見間違えやすい文字（0/O, 1/I）を除いた 32 文字。DB の generate_worldline_code と同じ */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_PATTERN = /^LN-[2-9A-HJ-NP-Z]{6}$/;

export function generateWorldlineCode(random: () => number = Math.random) {
  return `LN-${Array.from({ length: 6 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("")}`;
}

/** 入力を世界線IDの形に整える。形が違えば null */
export function normalizeWorldlineCode(input: string) {
  const code = input.trim().toUpperCase().replace(/^LN(?!-)/, "LN-");
  return CODE_PATTERN.test(code) ? code : null;
}

export type Presence = {
  /** 詠唱中なら開始時刻 */
  chantingSince: string | null;
  /** 最後に詠唱を終えた時刻 */
  lastChantAt: string | null;
  /** 滞在中のエリア ID */
  stageId: string | null;
};

export type Bond = {
  id: string;
  code: string;
  /** 結ばれた相手・申し出てきた相手の名前（応答待ちの申し出先は伏せる） */
  name: string | null;
  /** accepted: 結ばれた / outgoing: 相手の応答待ち / incoming: 相手からの申し出 */
  status: "accepted" | "outgoing" | "incoming";
  /** Supabase の相手プロフィール ID（結ばれた相手のみ。光のパルスの購読に使う） */
  partnerId: string | null;
  presence: Presence | null;
  /** デモモードの模擬の世界線 */
  simulated?: boolean;
};

/** 開いたまま放置された詠唱は、この時間を過ぎたら静寂として扱う */
const STALE_CHANT_MS = 3 * 60 * 60 * 1000;

export function isChanting(presence: Presence | null, now = Date.now()) {
  if (!presence?.chantingSince) return false;
  return now - new Date(presence.chantingSince).getTime() < STALE_CHANT_MS;
}

export function presenceStatus(presence: Presence | null, now = Date.now()) {
  return isChanting(presence, now) ? { label: "深き集中", note: "詠唱中", active: true } : { label: "静寂", note: "オフライン", active: false };
}

/** 「3時間前に詠唱完了」の形 */
export function lastChantLabel(presence: Presence | null, now = Date.now()) {
  if (!presence?.lastChantAt) return "まだ探求の記録はありません";
  const minutes = Math.max(0, Math.floor((now - new Date(presence.lastChantAt).getTime()) / 60_000));
  const ago =
    minutes < 1 ? "たった今" : minutes < 60 ? `${minutes}分前に` : minutes < 60 * 24 ? `${Math.floor(minutes / 60)}時間前に` : `${Math.floor(minutes / 60 / 24)}日前に`;
  return `${ago}詠唱完了`;
}

/** 「STAGE 2: 樹海の図書室」の形 */
export function stageLabel(presence: Presence | null) {
  const area = findArea(presence?.stageId);
  if (!area) return "所在は霧の向こう";
  const stage = stageOfArea(area);
  if (!stage) return area.name;
  return `STAGE ${stage.id}: ${stage.name}`;
}

// ---------------------------------------------------------------------
// デモモードの模擬: 世界線IDから決まる周期で、詠唱と静寂を繰り返す架空の探究者
// ---------------------------------------------------------------------
const SIMULATED_NAMES = ["セレス", "アルト", "ノエル", "リラ", "カイ", "ミナ", "エルド", "シオン", "ユラ", "ヴェガ"];

function seedOf(code: string) {
  let h = 2166136261;
  for (const ch of code) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function simulatedRhythm(code: string) {
  const seed = seedOf(code);
  return {
    seed,
    // 20〜40分ごとに 8〜15分の詠唱（動作確認で光のパルスを見られる程度の間隔）
    periodMs: (20 + (seed % 21)) * 60_000,
    chantMs: (8 + ((seed >>> 5) % 8)) * 60_000,
    offsetMs: ((seed >>> 9) % 40) * 60_000,
  };
}

export function simulatedName(code: string) {
  return SIMULATED_NAMES[seedOf(code) % SIMULATED_NAMES.length];
}

export function simulatedPresence(code: string, now = Date.now()): Presence {
  const { seed, periodMs, chantMs, offsetMs } = simulatedRhythm(code);
  const cycleStart = Math.floor((now + offsetMs) / periodMs) * periodMs - offsetMs;
  const chanting = now - cycleStart < chantMs;
  // 詠唱中なら前の周期の終わり、静寂ならこの周期の詠唱の終わりが最後の探求
  const lastEnd = chanting ? cycleStart - periodMs + chantMs : cycleStart + chantMs;
  return {
    chantingSince: chanting ? new Date(cycleStart).toISOString() : null,
    lastChantAt: new Date(lastEnd).toISOString(),
    stageId: AREAS[(seed >>> 13) % AREAS.length].id,
  };
}
