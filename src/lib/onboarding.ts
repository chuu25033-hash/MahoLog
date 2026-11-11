"use client";

import { setLocalFlag, useLocalFlag } from "./local-flag";

/** 案内を出す場所。書庫は各ボタンを巡る案内、ほかは画面やダイアログを開いたときの案内 */
export type GuideId = "library" | "chant" | "traces" | "codex" | "settings" | "zenith" | "trials" | "areas";

export const GUIDE_IDS: GuideId[] = ["library", "chant", "traces", "codex", "settings", "zenith", "trials", "areas"];

/** 案内を終えた・飛ばしたかの印。書庫の案内は以前からの名前のまま残す */
const keyOf = (id: GuideId) => (id === "library" ? "maholog_library_tour_completed" : `maholog_guide_${id}_seen`);

export const useGuideSeen = (id: GuideId) => useLocalFlag(keyOf(id));
export const markGuideSeen = (id: GuideId) => setLocalFlag(keyOf(id));
/** 設定から案内をもう一度見るときに、すべての印を外す（各画面を次に開いたとき、また案内する） */
export const resetAllGuides = () => GUIDE_IDS.forEach((id) => setLocalFlag(keyOf(id), false));

export const useLibraryTourDone = () => useGuideSeen("library");
export const markLibraryTourDone = () => markGuideSeen("library");
/** 設定から書庫の案内をもう一度見るときに印を外す */
export const resetLibraryTour = () => setLocalFlag(keyOf("library"), false);
