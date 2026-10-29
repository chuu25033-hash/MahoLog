"use client";

// 星天の導き（1日1回の授かり物）。
// 受け取った日（JST）と連続日数はユーザーデータ（dailyReward）に保持する。
import { jstDateKey } from "./date";
import { findItem, type Item } from "./items";
import { getUserData, userActions } from "./user-store";

const DAY = 24 * 60 * 60 * 1000;
export const GUIDANCE_CYCLE = 7;

/** 周期の各夜に授かる品（7夜目は極光の輝石） */
const REWARD_IDS = ["g-stardust", "c-catalyst", "g-stardust", "c-prism", "g-stardust", "c-hourglass", "g-aurora"] as const;

export type Guidance = {
  /** 本日が周期内の何夜目か（1〜7） */
  night: number;
  reward: Item;
};

/** 本日まだ受け取っていなければ、授かる導きを返す */
export function pendingGuidance(now = new Date()): Guidance | null {
  const { lastClaimedDate, streak } = getUserData().dailyReward;
  if (lastClaimedDate === jstDateKey(now)) return null;
  // 前日から途切れずに続いていれば次の夜へ。途切れたら1夜目からやり直す
  const continued = lastClaimedDate === jstDateKey(new Date(now.getTime() - DAY));
  const night = continued ? (streak % GUIDANCE_CYCLE) + 1 : 1;
  return { night, reward: findItem(REWARD_IDS[night - 1])! };
}

/** 導きを受け取る: 受取日・連続日数を更新し、授かり物を所持品へ加える */
export function claimGuidance(guidance: Guidance, now = new Date()) {
  userActions.claimDailyReward(now);
  userActions.addItem(guidance.reward);
}
