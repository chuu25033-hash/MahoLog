"use client";

import { setLocalFlag, useLocalFlag } from "./local-flag";

/** 書庫の案内（各ボタンを巡る説明）を終えた・飛ばしたか */
const TOUR_KEY = "maholog_library_tour_completed";

export const useLibraryTourDone = () => useLocalFlag(TOUR_KEY);
export const markLibraryTourDone = () => setLocalFlag(TOUR_KEY);
/** 設定から書庫の案内をもう一度見るときに印を外す */
export const resetLibraryTour = () => setLocalFlag(TOUR_KEY, false);

