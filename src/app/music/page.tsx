import { AdminMusic } from "@/components/trailer/admin-music";

/** 曲の試聴と、動画に使う WAV の書き出し。管理者の観測者IDでだけ開ける（それ以外は書庫へ戻す） */
export default function MusicPage() {
  return <AdminMusic />;
}
