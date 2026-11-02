import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ScoreShort } from "@/components/trailer/score-short";
import { SONGS, type SongKey } from "@/lib/sound/music";

type Query = Promise<Record<string, string | string[] | undefined>>;

/**
 * 曲を主役にした TikTok 用の動画（撮影用）。右から楽譜が流れ、演奏線で音が光る。開発サーバーでだけ開ける。
 * ?song=stars&from=chorus&sec=30 のように、曲・始める位置・長さを選ぶ
 */
export default function ScorePage({ searchParams }: { searchParams: Query }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense>
      <Score searchParams={searchParams} />
    </Suspense>
  );
}

async function Score({ searchParams }: { searchParams: Query }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const song = (one(q.song) ?? "stars") as SongKey;
  const from = one(q.from) === "intro" ? "intro" : "chorus";
  const seconds = Math.max(5, Math.min(120, Number(one(q.sec)) || 30));
  return <ScoreShort song={song in SONGS ? song : "stars"} from={from} seconds={seconds} />;
}
