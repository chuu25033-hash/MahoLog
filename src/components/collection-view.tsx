"use client";

import { useState } from "react";
import { Check, Paintbrush, Sparkles } from "lucide-react";
import { ItemArt } from "@/components/item-art";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { findArea, type Rarity } from "@/lib/areas";
import { ALL_ITEMS, RARITY_LABEL, type Item } from "@/lib/items";
import { armedCatalyst, mockActions, useMockState, type MockState } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

const SECTIONS: { rarity: Rarity; caption: string }[] = [
  { rarity: "A", caption: "魔法陣の発光色・背景を変える永続アイテム" },
  { rarity: "B", caption: "各エリアに眠る伝承の品" },
  { rarity: "C", caption: "次回の詠唱で獲得MPを高める消耗品" },
];

/** 魔導図鑑: 獲得したアイテムをカードで並べる（未獲得はグレーアウト） */
export function CollectionView() {
  const mock = useMockState();
  const [selected, setSelected] = useState<Item | null>(null);
  const found = ALL_ITEMS.filter((i) => mock.discovered.includes(i.id)).length;

  return (
    <div className="flex flex-col gap-4 p-3 lg:p-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-baseline gap-2 text-xl tracking-[0.25em] whitespace-nowrap">
            魔導図鑑
            <span className="font-display text-[10px] tracking-[0.3em] text-starlight/70">ARCANE CODEX</span>
          </h1>
          <p className="text-xs tracking-wider text-muted-foreground">詠唱を終えると、滞在エリアの宝箱からアイテムが見つかることがあります</p>
        </div>
        <p className="text-right text-xs tracking-wider whitespace-nowrap text-muted-foreground">
          収集率
          <span className="ml-2 font-display text-2xl text-starlight-gradient">{found}</span>
          <span className="font-display"> / {ALL_ITEMS.length}</span>
        </p>
      </header>

      {SECTIONS.map(({ rarity, caption }) => {
        const items = ALL_ITEMS.filter((i) => i.rarity === rarity);
        return (
          <section key={rarity} className="glass rounded-2xl p-3 lg:p-4">
            <h2 className="mb-3 flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
              <span className="font-display text-[11px] text-starlight/80">RARE {rarity}</span>
              {RARITY_LABEL[rarity]}
              <span className="min-w-0 truncate text-[11px] tracking-wider text-muted-foreground">{caption}</span>
              <span className="ml-auto font-display text-xs text-muted-foreground">
                {items.filter((i) => mock.discovered.includes(i.id)).length} / {items.length}
              </span>
            </h2>
            <ul className="grid grid-cols-6 gap-2 lg:grid-cols-8">
              {items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} mock={mock} onSelect={() => setSelected(item)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {selected && <ItemDialog item={selected} mock={mock} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ItemCard({ item, mock, onSelect }: { item: Item; mock: MockState; onSelect: () => void }) {
  const owned = mock.discovered.includes(item.id);
  const count = mock.inventory[item.id] ?? 0;
  const equipped = (item.kind === "skin" && mock.skinId === item.id) || (item.kind === "catalyst" && armedCatalyst(mock)?.id === item.id);

  return (
    <button
      disabled={!owned}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col items-center gap-1 rounded-xl border px-1 pt-2 pb-1.5 transition-all duration-300",
        owned
          ? "border-white/12 bg-gradient-to-b from-white/[0.04] to-transparent hover:border-starlight/40 hover:shadow-[0_0_14px_-4px_rgba(226,201,116,0.45)]"
          : "cursor-default border-white/5 grayscale",
        equipped && "border-starlight/50",
      )}
    >
      <ItemArt
        glyph={item.glyph}
        rarity={item.rarity}
        color={item.color}
        seed={item.id}
        locked={!owned}
        className="aspect-square w-full max-w-20 transition-transform duration-500 group-hover:scale-105"
      />
      <span className={cn("w-full truncate text-center text-[10px] tracking-wider", owned ? "text-foreground" : "text-muted-foreground/60")}>
        {owned ? item.name : "？？？"}
      </span>
      {item.kind === "lore" && (
        <span className="font-display text-[9px] text-muted-foreground/70">AREA {item.areaId}</span>
      )}
      {item.kind === "catalyst" && owned && (
        <span className="absolute top-1 right-1.5 font-display text-[10px] text-aqua">×{count}</span>
      )}
      {equipped && <Check className="absolute top-1 left-1.5 size-3 text-starlight" />}
    </button>
  );
}

function ItemDialog({ item, mock, onClose }: { item: Item; mock: MockState; onClose: () => void }) {
  const area = item.kind === "lore" ? findArea(item.areaId) : undefined;
  const count = mock.inventory[item.id] ?? 0;
  const armed = armedCatalyst(mock)?.id === item.id;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md! grid-cols-[8rem_1fr] items-center gap-4 rounded-2xl p-5 ring-starlight/25 backdrop-blur-xl sm:max-w-md!">
        <ItemArt glyph={item.glyph} rarity={item.rarity} color={item.color} seed={item.id} className="aspect-square w-full" />
        <div className="flex flex-col gap-2">
          <p className="font-display text-[10px] tracking-[0.25em] text-starlight/80">
            RARE {item.rarity} · {RARITY_LABEL[item.rarity]}
          </p>
          <DialogTitle className="text-base tracking-[0.15em]">『{item.name}』</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {item.kind === "lore" ? item.lore : item.effect}
          </DialogDescription>
          {area && <p className="text-[11px] text-muted-foreground">出土地: AREA {area.id} {area.name}</p>}

          {item.kind === "skin" && (
            <Button
              size="sm"
              variant={mock.skinId === item.id ? "outline" : "default"}
              onClick={() => mockActions.setSkin(mock.skinId === item.id ? null : item.id)}
            >
              <Paintbrush /> {mock.skinId === item.id ? "標準に戻す" : "このスキンを適用"}
            </Button>
          )}
          {item.kind === "catalyst" && (
            <Button
              size="sm"
              variant={armed ? "outline" : "default"}
              disabled={count === 0}
              onClick={() => mockActions.armCatalyst(armed ? null : item.id)}
            >
              <Sparkles /> {count === 0 ? "所持していません" : armed ? "装備を外す" : `次回の詠唱に使う（残り${count}）`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
