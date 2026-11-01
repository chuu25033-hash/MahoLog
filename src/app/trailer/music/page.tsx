import { notFound } from "next/navigation";
import { MusicPlayer } from "@/components/trailer/music-player";

/** 曲の試聴と、TikTok などの動画に使う WAV の書き出し。開発サーバーでだけ開ける */
export default function MusicPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MusicPlayer />;
}
