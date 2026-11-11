"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useStoredUserData } from "@/lib/user-store";
import { LIBRARY_STEPS } from "./guide-steps";
import { PageGuide } from "./guide-tour";

/**
 * 初めて書庫に入ったときの案内。各ボタンを順に照らし、何をするところかを語る。
 * いつでも飛ばせる。終えるか飛ばすと印を残し、二度目からは出さない（設定から見返せる）
 */
export function LibraryTour() {
  const router = useRouter();
  const data = useStoredUserData();
  // 設定の「案内をもう一度見る」から来たか。画面が移った直後は window.location がまだ古いので、ルーターから読む
  const replay = useSearchParams().has("tour");
  // 既に詠唱を重ねている人には、改めて案内しない（設定から見返せる）
  const veteran = (data?.chantHistory.length ?? 0) > 0 && !replay;
  return (
    <PageGuide
      id="library"
      steps={LIBRARY_STEPS}
      auto={!!data && !veteran}
      // 見返すために付けた印は消しておく
      onFinish={() => replay && router.replace("/dashboard", { scroll: false })}
    />
  );
}
