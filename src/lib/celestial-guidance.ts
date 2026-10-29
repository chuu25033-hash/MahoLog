"use client";

// 星天の導き（1日1回の授かり物）のローカルモック。
// 受け取った日（JST）と7日周期の連続日数を localStorage に保持する。
import { startOfJstDay } from "./date";
import { findItem, type Item } from "./items";

const STORAGE_KEY = "maholog:guidance:v1";
const DAY = 24 * 60 * 60 * 1000;
export const GUIDANCE_CYCLE = 7;

/** 周期の各夜に授かる品（7夜目は極光の輝石） */
const REWARD_IDS = ["g-stardust", "c-catalyst", "g-stardust", "c-prism", "g-stardust", "c-hourglass", "g-aurora"] as const;

type ClaimRecord = {
  /** 最後に受け取った日の JST 0:00（ms） */
  claimedDay: number;
  /** 周期内で何夜目まで受け取ったか（1〜7） */
  night: number;
};

export type Guidance = {
  /** 本日が周期内の何夜目か（1〜7） */
  night: number;
  reward: Item;
};

function read(): ClaimRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ClaimRecord) : null;
  } catch {
    return null;
  }
}

/** 本日まだ受け取っていなければ、授かる導きを返す */
export function pendingGuidance(now = new Date()): Guidance | null {
  const today = startOfJstDay(now).getTime();
  const last = read();
  if (last?.claimedDay === today) return null;
  // 前夜から途切れずに続いていれば次の夜へ。途切れたら1夜目からやり直す
  const continued = last !== null && last.claimedDay === today - DAY;
  const night = continued ? (last.night % GUIDANCE_CYCLE) + 1 : 1;
  return { night, reward: findItem(REWARD_IDS[night - 1])! };
}

export function claimGuidance(guidance: Guidance, now = new Date()) {
  const record: ClaimRecord = { claimedDay: startOfJstDay(now).getTime(), night: guidance.night };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {}
}
