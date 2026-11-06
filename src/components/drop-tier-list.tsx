import type { Rarity } from "@/lib/areas";
import { DROP_SLOT_MINUTES, DROP_TIERS, PITY_MISSES, RARE_PITY_MISSES } from "@/lib/drops";
import { RARITY_LABEL } from "@/lib/items";
import { METEOR_SHOWER_MINUTES, METEOR_UPGRADE_S_CHANCE } from "@/lib/reward";

/** 確率を並べる順（常品から至宝へ）と、その色 */
const RATE_ORDER: { rarity: Rarity; tone: string }[] = [
  { rarity: "C", tone: "text-muted-foreground" },
  { rarity: "B", tone: "text-aqua/90" },
  { rarity: "A", tone: "text-amethyst" },
  { rarity: "S", tone: "text-starlight" },
];

/**
 * 詠唱の長さごとに降る流れ星の数と原石、1つごとのレア度の確率
 * （エリアの案内と、詠唱の間の「流れ星の区切り」で使う）
 */
export function DropTierList() {
  return (
    <>
      <ul className="space-y-1">
        {DROP_TIERS.map((t) => (
          <li key={t.minMinutes}>
            <div className="flex justify-between gap-2">
              <span className="font-display whitespace-nowrap">{t.minMinutes}分〜</span>
              <span className="whitespace-nowrap">
                <span className="font-display text-starlight">{t.slots}</span>つ
                {t.ore > 0 && <span className="ml-1 text-[10px] text-aqua">＋原石{t.ore}</span>}
              </span>
            </div>
            <p className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground/80">
              {RATE_ORDER.map(({ rarity, tone }) => (
                <span key={rarity} className="whitespace-nowrap">
                  {RARITY_LABEL[rarity]} <span className={`font-display ${tone}`}>{t.rates[rarity]}%</span>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
        確率は流れ星1つごと（至宝は「星空の観測塔」から降り始める）。長く続けた詠唱ほど稀な品が降りやすく、{DROP_TIERS[DROP_TIERS.length - 1].minMinutes}分を越えると稀品以上が1つ確定する。{DROP_SLOT_MINUTES}分に届かない端数は、次の詠唱へ持ち越される
      </p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
        {METEOR_SHOWER_MINUTES}分を越えると流星群が近づき、流れ星の1つを秘宝へ引き上げることがある（至宝になるのは{METEOR_UPGRADE_S_CHANCE}%）。稀品以上が{RARE_PITY_MISSES}回続けて降らなければ、次の詠唱で稀品以上が必ず降る。秘宝以上が{PITY_MISSES}回続けて降らなければ、次の詠唱で秘宝が必ず降る。遺物の加護と星脈との同調で、稀品以上が降りやすくなる
      </p>
    </>
  );
}
