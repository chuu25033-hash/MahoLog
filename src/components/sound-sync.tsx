"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { findArea } from "@/lib/areas";
import { AMBIENCE_BY_STAGE } from "@/lib/sound/sound-files";
import { soundManager } from "@/lib/sound/sound-manager";
import { useStoredUserData } from "@/lib/user-store";

/** タイトルの曲を流す画面 */
const TITLE_PATHS = ["/", "/login"];
/** 魔術書庫に入る前の画面。旅立ちの環境音を流す */
const PRELUDE_PATHS = ["/guidance"];

/** 設定の音量と、いまの画面・滞在中のステージを、アプリ全体の音（環境音・効果音）に映す */
export function SoundSync() {
  const pathname = usePathname();
  const title = TITLE_PATHS.includes(pathname);
  const prelude = PRELUDE_PATHS.includes(pathname);
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
    if (title) soundManager.setAmbience("title");
    else if (prelude) soundManager.setAmbience("prelude");
    else soundManager.setAmbience(stageId === null ? null : (AMBIENCE_BY_STAGE[stageId] ?? null));
  }, [title, prelude, stageId]);

  // タイトルの曲は、ブラウザが許していれば操作を待たずに流し始める
  useEffect(() => {
    if (title) soundManager.tryStart();
  }, [title]);

  return null;
}
