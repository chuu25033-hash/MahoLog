import { DROP_SLOT_MINUTES, DROP_TIERS } from "@/lib/drops";

/** 詠唱の長さごとに降る流れ星の数と原石（エリアの案内と、詠唱の間の「流れ星の区切り」で使う） */
export function DropTierList() {
  return (
    <>
      <ul className="space-y-0.5">
        {DROP_TIERS.map((t) => (
          <li key={t.minMinutes} className="flex justify-between gap-2">
            <span className="font-display whitespace-nowrap">{t.minMinutes}分〜</span>
            <span className="whitespace-nowrap">
              <span className="font-display text-starlight">{t.slots}</span>つ
              {t.ore > 0 && <span className="ml-1 text-[10px] text-aqua">＋原石{t.ore}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
        長く続けた詠唱ほど稀な品が降りやすく、{DROP_TIERS[DROP_TIERS.length - 1].minMinutes}分を越えると稀品以上が1つ確定する。{DROP_SLOT_MINUTES}分に届かない端数は、次の詠唱へ持ち越される
      </p>
    </>
  );
}
