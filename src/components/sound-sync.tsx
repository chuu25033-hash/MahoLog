"use client";

import { useEffect } from "react";
import { findArea } from "@/lib/areas";
import { AMBIENCE_BY_STAGE } from "@/lib/sound/sound-files";
import { soundManager } from "@/lib/sound/sound-manager";
import { useStoredUserData } from "@/lib/user-store";

/** 設定の音量と滞在中のステージを、アプリ全体の音（環境音・効果音）に映す */
export function SoundSync() {
  const data = useStoredUserData();
  const settings = data?.settings;
  const stageId = data ? (findArea(data.userProfile.currentStageId)?.stageId ?? 1) : null;

  useEffect(() => soundManager.attach(), []);

  useEffect(() => {
    if (!settings) return;
    soundManager.setEnabled(settings.sound);
    soundManager.setVolumes({ bgm: settings.bgmVolume, se: settings.seVolume });
  }, [settings]);

  useEffect(() => {
    soundManager.setAmbience(stageId === null ? null : (AMBIENCE_BY_STAGE[stageId] ?? null));
  }, [stageId]);

  return null;
}
