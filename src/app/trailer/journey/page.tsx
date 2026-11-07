import { notFound } from "next/navigation";
import { JourneyShort } from "@/components/trailer/journey-short";

/** TikTok「勉強した時間だけ、旅が進む。」（撮影用）。少女が STAGE 1〜6 を歩き抜ける。開発サーバーでだけ開ける */
export default function JourneyShortPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <JourneyShort />;
}
