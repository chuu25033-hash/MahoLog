"use client";

import { useState, type CSSProperties } from "react";
import { Check, Paintbrush, Sparkles } from "lucide-react";
import { ItemArt } from "@/components/item-art";
import { MpBar } from "@/components/mp-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { findArea, type Rarity } from "@/lib/areas";
import { STAGES } from "@/lib/game";
import { ALL_ITEMS, GUIDANCE_CATALYSTS, ITEM_TYPES, RARITIES, RARITY_LABEL, type Item, type ItemType } from "@/lib/items";
import { armedCatalyst, isDiscovered, userActions, useUserData, type UserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

const RARITY_CAPTION: Record<Rarity, string> = {
  S: "世界の理そのものに触れる、伝説の遺物",
  A: "所持するだけで加護を授ける秘宝と、魔法陣の装い",
  B: "各エリアに眠る伝承の品",
  C: "次回の詠唱で獲得MPを高める消耗品",
};

const RARITY_TONE: Record<Rarity, string> = {
  S: "border-starlight/70 text-starlight text-glow-gold",
  A: "border-amethyst/55 text-amethyst",
  B: "border-starlight/45 text-starlight",
  C: "border-aqua/40 text-aqua",
};

type Filter = "すべて" | ItemType;
const FILTERS: Filter[] = ["すべて", ...ITEM_TYPES];

/** 古代の秘術図鑑: 遺物を解読・閲覧する（未所持はシルエット） */
export function CollectionView() {
  const data = useUserData();
  const [filter, setFilter] = useState<Filter>("すべて");
  const [selected, setSelected] = useState<Item | null>(null);
  const found = ALL_ITEMS.filter((i) => isDiscovered(data, i.id)).length;
  const rate = found / ALL_ITEMS.length;
  const visible = ALL_ITEMS.filter((i) => filter === "すべて" || i.type === filter);

  return (
    <div className="scroll-area flex h-full flex-col gap-4 p-3 lg:p-5">
      <header className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2 text-xl tracking-[0.25em] whitespace-nowrap">
            古代の秘術図鑑
            <span className="truncate font-display text-[10px] tracking-[0.3em] text-starlight/70">ARCANE CODEX</span>
          </h1>
          <p className="text-xs tracking-wider text-muted-foreground [word-break:auto-phrase]">
            宝箱や星天の導きで見つけた遺物を解読し、その来歴と秘めた力を書き留めます
          </p>
        </div>
        <div className="w-52 shrink-0">
          <p className="flex items-baseline justify-between text-[11px] tracking-[0.2em] whitespace-nowrap text-muted-foreground">
            秘術解読率
            <span>
              <span className="font-display text-2xl text-starlight-gradient">{Math.floor(rate * 100)}</span>
              <span className="font-display"> %</span>
            </span>
          </p>
          <MpBar ratio={rate} variant="stage" />
          <p className="mt-1 text-right font-display text-[10px] tracking-[0.2em] text-muted-foreground">
            {found} / {ALL_ITEMS.length} DECIPHERED
          </p>
        </div>
      </header>

      <div role="tablist" aria-label="分類" className="flex w-fit gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
        {FILTERS.map((f) => {
          const items = ALL_ITEMS.filter((i) => f === "すべて" || i.type === f);
          const active = f === filter;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-baseline gap-1.5 rounded-full px-4 py-1.5 tracking-[0.2em] whitespace-nowrap transition-all duration-300",
                active
                  ? "bg-gradient-to-b from-starlight/15 to-aqua/5 text-starlight ring-1 ring-starlight/35"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
              <span className="font-display text-[10px] opacity-70">
                {items.filter((i) => isDiscovered(data, i.id)).length}/{items.length}
              </span>
            </button>
          );
        })}
      </div>

      {RARITIES.map((rarity) => {
        const items = visible.filter((i) => i.rarity === rarity);
        if (items.length === 0) return null;
        return (
          <section key={rarity} className="glass rounded-2xl p-3 lg:p-4">
            <h2 className="mb-3 flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
              <span className={cn("font-display text-[11px]", rarity === "S" ? "text-starlight text-glow-gold" : "text-starlight/80")}>RARE {rarity}</span>
              {RARITY_LABEL[rarity]}
              <span className="min-w-0 truncate text-[11px] tracking-wider text-muted-foreground">{RARITY_CAPTION[rarity]}</span>
              <span className="ml-auto font-display text-xs text-muted-foreground">
                {items.filter((i) => isDiscovered(data, i.id)).length} / {items.length}
              </span>
            </h2>
            <ul className="grid grid-cols-6 gap-2 lg:grid-cols-8">
              {items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} data={data} onSelect={() => setSelected(item)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {selected && <DecipherDialog item={selected} data={data} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ItemCard({ item, data, onSelect }: { item: Item; data: UserData; onSelect: () => void }) {
  const owned = isDiscovered(data, item.id);
  const count = data.inventory[item.id] ?? 0;
  const equipped = (item.kind === "skin" && data.equipment.skinId === item.id) || (item.kind === "catalyst" && armedCatalyst(data)?.id === item.id);

  return (
    <button
      onClick={onSelect}
      aria-label={owned ? item.name : "未解読の遺物"}
      className={cn(
        "group relative flex w-full flex-col items-center gap-1 rounded-xl border px-1 pt-2 pb-1.5 transition-all duration-300",
        owned
          ? "border-white/12 bg-gradient-to-b from-white/[0.04] to-transparent hover:border-starlight/40 hover:shadow-[0_0_14px_-4px_rgba(226,201,116,0.45)]"
          : "border-white/5 bg-black/20 hover:border-white/15",
        owned && item.rarity === "S" && "border-starlight/30 shadow-[0_0_18px_-8px_rgba(226,201,116,0.6)]",
        equipped && "border-starlight/50",
      )}
    >
      <ItemArt
        icon={item.svgIcon}
        rarity={item.rarity}
        color={item.color}
        seed={item.id}
        locked={!owned}
        className="aspect-square w-full max-w-20 transition-transform duration-500 group-hover:scale-105"
      />
      <span className={cn("w-full truncate text-center text-[10px] tracking-wider", owned ? "text-foreground" : "text-muted-foreground/50")}>
        {owned ? item.name : "？？？"}
      </span>
      <span className="font-display text-[9px] tracking-[0.15em] text-muted-foreground/70">
        {item.kind === "lore" ? `AREA ${item.areaId}` : owned ? item.type : "UNKNOWN"}
      </span>
      {item.kind === "catalyst" && owned && (
        <span className="absolute top-1 right-1.5 font-display text-[10px] text-aqua">×{count}</span>
      )}
      {equipped && <Check className="absolute top-1 left-1.5 size-3 text-starlight" />}
    </button>
  );
}

/** 見つかる場所の手がかり */
function originHint(item: Item) {
  if (item.kind === "lore") {
    const area = findArea(item.areaId);
    return `AREA ${item.areaId} ${area?.name ?? ""}の宝箱`;
  }
  if (item.kind === "catalyst") return GUIDANCE_CATALYSTS.includes(item) ? "星天の導き" : "各エリアの宝箱";
  const stage = STAGES.find((s) => s.id === item.stageId);
  return `STAGE ${item.stageId}「${stage?.name ?? ""}」以降の宝箱`;
}

/** 遺物の解読ダイアログ: 回転する魔法陣の上で、ラインアートがゆっくり浮遊する */
function DecipherDialog({ item, data, onClose }: { item: Item; data: UserData; onClose: () => void }) {
  const owned = isDiscovered(data, item.id);
  const count = data.inventory[item.id] ?? 0;
  const armed = armedCatalyst(data)?.id === item.id;
  const color = owned ? item.color : "#64748b";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-md! gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] p-5 ring-starlight/25 backdrop-blur-2xl sm:max-w-md!">
        <div className="flex items-center justify-center gap-2">
          <span className={cn("rounded-full border px-2 font-display text-[10px] tracking-[0.2em]", RARITY_TONE[item.rarity])}>
            RARE {item.rarity} · {RARITY_LABEL[item.rarity]}
          </span>
          <span className="rounded-full border border-white/15 px-2 text-[10px] tracking-[0.2em] text-muted-foreground">{item.type}</span>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-60 short:max-w-44">
          <CodexSigil color={color} dim={!owned} className="absolute inset-0 size-full" />
          <div className="codex-float absolute inset-[22%]">
            <ItemArt icon={item.svgIcon} rarity={item.rarity} color={item.color} seed={item.id} locked={!owned} className="size-full" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <DialogTitle className="max-w-full truncate text-base tracking-[0.2em] whitespace-nowrap">
            {owned ? `『${item.name}』` : "未解読の遺物"}
          </DialogTitle>
          <p className="font-display text-[10px] tracking-[0.25em] text-starlight/60">{owned ? item.id.toUpperCase() : "UNDECIPHERED"}</p>
        </div>

        <DialogDescription className="text-center text-xs leading-relaxed tracking-wider [word-break:auto-phrase]">
          {owned ? item.flavorText : "刻まれた文字はまだ読み解けない。手に入れたとき、この遺物は自らの来歴を語り始める。"}
        </DialogDescription>

        {owned && item.effect && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center">
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground">秘めた力</p>
            <p className="text-sm tracking-wider text-aqua [word-break:auto-phrase]">{item.effect}</p>
          </div>
        )}

        <p className="text-center text-[11px] tracking-wider text-muted-foreground">
          {owned ? "出土地" : "手がかり"}: {originHint(item)}
          {owned && item.kind === "catalyst" && <span className="ml-2">所持 ×{count}</span>}
        </p>

        {owned && item.kind === "skin" && (
          <Button
            size="sm"
            variant={data.equipment.skinId === item.id ? "outline" : "default"}
            onClick={() => userActions.setSkin(data.equipment.skinId === item.id ? null : item.id)}
          >
            <Paintbrush /> {data.equipment.skinId === item.id ? "標準に戻す" : "このスキンを適用"}
          </Button>
        )}
        {owned && item.kind === "catalyst" && (
          <Button
            size="sm"
            variant={armed ? "outline" : "default"}
            disabled={count === 0}
            onClick={() => userActions.armCatalyst(armed ? null : item.id)}
          >
            <Sparkles /> {count === 0 ? "所持していません" : armed ? "装備を外す" : `次回の詠唱に使う（残り${count}）`}
          </Button>
        )}
        {owned && item.kind === "relic" && (
          <p className="text-center text-[11px] tracking-[0.2em] text-starlight/80">所持しているあいだ、加護が働き続けます</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 解読の魔法陣: 外環はゆっくり回り、全体が静かに明滅する */
function CodexSigil({ color, dim, className }: { color: string; dim: boolean; className?: string }) {
  const runePath = "M0,-41 A41,41 0 1,1 -0.01,-41";
  return (
    <svg
      viewBox="-50 -50 100 100"
      className={cn("codex-sigil overflow-visible", dim && "opacity-40", className)}
      style={{ "--sigil-color": color } as CSSProperties}
      aria-hidden
    >
      <defs>
        <path id="codex-rune-path" d={runePath} />
        <radialGradient id="codex-sigil-glow">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="60%" stopColor={color} stopOpacity="0.06" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="48" fill="url(#codex-sigil-glow)" />
      <g className="codex-sigil-outer" stroke={color}>
        <circle r="47" strokeOpacity="0.45" {...hairline} />
        <circle r="44.5" strokeOpacity="0.3" {...hairline} />
        {Array.from({ length: 72 }, (_, i) => (
          <line key={i} y1="-47" y2={i % 6 === 0 ? -44.5 : -45.8} strokeOpacity={i % 6 === 0 ? 0.6 : 0.3} transform={`rotate(${i * 5})`} {...hairline} />
        ))}
        <text fontSize="3.4" fill={color} fillOpacity="0.55" letterSpacing="1.2">
          <textPath href="#codex-rune-path">{RUNES.repeat(2)}</textPath>
        </text>
      </g>
      <g className="codex-sigil-inner" stroke={color}>
        <circle r="37" strokeOpacity="0.25" strokeDasharray="1 2.5" {...hairline} />
        <polygon points={triangle(36, 0)} strokeOpacity="0.22" {...hairline} />
        <polygon points={triangle(36, 60)} strokeOpacity="0.22" {...hairline} />
        <circle r="31" strokeOpacity="0.18" {...hairline} />
      </g>
    </svg>
  );
}

/** 六芒星を成す正三角形 */
function triangle(r: number, offset: number) {
  return Array.from({ length: 3 }, (_, i) => {
    const angle = ((offset + i * 120 - 90) * Math.PI) / 180;
    return `${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`;
  }).join(" ");
}
