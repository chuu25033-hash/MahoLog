"use client";

import { setLocalFlag, useLocalFlag } from "./local-flag";

/** 書庫の案内（各ボタンを巡る説明）を終えた・飛ばしたか */
const TOUR_KEY = "maholog_library_tour_completed";
/** 初めて書庫に入ったときの、観測者IDと復元キーの確認の案内を済ませたか */
const KEY_GUIDE_KEY = "maholog_first_library_guided";

export const useLibraryTourDone = () => useLocalFlag(TOUR_KEY);
export const markLibraryTourDone = () => setLocalFlag(TOUR_KEY);
/** 設定から書庫の案内をもう一度見るときに印を外す */
export const resetLibraryTour = () => setLocalFlag(TOUR_KEY, false);

export const useKeyGuideDone = () => useLocalFlag(KEY_GUIDE_KEY);
export const markKeyGuideDone = () => setLocalFlag(KEY_GUIDE_KEY);
