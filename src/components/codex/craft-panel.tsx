"use client";

import { useState, type CSSProperties } from "react";
import { Check, Flame, Hexagon, X } from "lucide-react";
import { ItemArt } from "@/components/item-art";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canCraft, dissolvables, oreCount, recipeRelics } from "@/lib/crafting";
import { MYTHICS, STARDUST_ORE, type Item, type RelicItem } from "@/lib/items";
import { soundManager } from "@/lib/sound/sound-manager";
import { userActions, type UserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 錬成陣: 余った遺物を星屑の原石へ還元し、原石と秘宝を捧げて神話遺物（SS）を生み出す */
export function CraftPanel({ data }: { data: UserData }) {
  const [confirm, setConfirm] = useState<RelicItem | null>(null);
  const [ritual, setRitual] = useState<RelicItem | null>(null);
  const [dissolved, setDissolved] = useState<Dissolved | null>(null);
  const ore = oreCount(data);
  const list = dissolvables(data);

  function craft(mythic: RelicItem) {
    setConfirm(null);
    const made = userActions.craft(mythic.id);
    if (!made) return;
    soundManager.playSe("craft");
    setRitual(made);
  }

  function dissolve(item: Item, amount: number) {
    const before = ore;
    const gained = userActions.dissolve(item.id, amount);
    if (gained <= 0) return;
    soundManager.playSe("dissolve");
    setDissolved({ item, amount, gained, total: before + gained });
  }

  return (
    <div className="grid grid-cols-5 gap-3 portrait:grid-cols-1 lg:gap-4">
      <section className="glass col-span-3 rounded-2xl portrait:col-span-1 p-3 lg:p-4">
        <h2 className="mb-1 flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
          <Hexagon className="size-4 shrink-0 self-center text-starlight" strokeWidth={1.25} />
          <span className="flex flex-col leading-tight">
            錬成陣
            <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">TRANSMUTATION</span>
          </span>
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed tracking-wider text-muted-foreground [word-break:auto-phrase]">
          星屑の原石と指定の秘宝・至宝を捧げ、流れ星が運ぶことのない神話遺物（SS）を錬成します。捧げた遺物の加護は、神話遺物の加護へと受け継がれます
        </p>
        <ul className="grid grid-cols-2 gap-2 portrait:grid-cols-1">
          {MYTHICS.map((mythic) => (
            <li key={mythic.id}>
              <RecipeCard mythic={mythic} data={data} onCraft={() => setConfirm(mythic)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="glass col-span-2 flex flex-col rounded-2xl portrait:col-span-1 p-3 lg:p-4">
        <h2 className="mb-1 flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
          <Flame className="size-4 shrink-0 self-center text-starlight" strokeWidth={1.25} />
          <span className="flex flex-col leading-tight">
            還元
            <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">DISSOLUTION</span>
          </span>
        </h2>
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-aqua/25 bg-aqua/[0.04] px-3 py-2">
          <ItemArt icon={STARDUST_ORE.svgIcon} rarity="C" color={STARDUST_ORE.color} seed={STARDUST_ORE.id} className="size-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm tracking-[0.15em] whitespace-nowrap">{STARDUST_ORE.name}</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">{STARDUST_ORE.flavorText}</p>
          </div>
          <p className="ml-auto shrink-0 font-display text-2xl text-aqua text-glow-aqua">{ore}</p>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed tracking-wider text-muted-foreground [word-break:auto-phrase]">
          触媒はすべて、断片・伝承の品・陣の意匠・秘宝・至宝は2つ目以降（余剰）だけを還元できます。未復元の文書の断片は1葉ずつ手元に残ります
        </p>
        {list.length === 0 ? (
          <p className="my-auto py-6 text-center text-xs tracking-wider text-muted-foreground">還元できる余剰の遺物はありません</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 scroll-area scrollbar-none">
            {list.map(({ item, count, value }) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                <ItemArt icon={item.svgIcon} rarity={item.rarity} color={item.color} seed={item.id} className="size-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-wider">{item.name}</p>
                  <p className="text-[10px] tracking-wider text-muted-foreground">
                    余剰 ×{count} ・ 1つで原石 <span className="font-display text-aqua">{value}</span>
                  </p>
                </div>
                <Button size="xs" variant="outline" onClick={() => dissolve(item, 1)}>
                  1つ
                </Button>
                {count > 1 && (
                  <Button size="xs" variant="secondary" onClick={() => dissolve(item, count)}>
                    すべて
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirm && (
        <Dialog open onOpenChange={(open) => !open && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="tracking-wider">『{confirm.name}』を錬成しますか？</DialogTitle>
              <DialogDescription className="[word-break:auto-phrase]">
                星屑の原石 {confirm.recipe!.ore} と、{recipeRelics(confirm).map((r) => `『${r.name}』`).join("")}を錬成陣に捧げます。
                捧げた遺物は手元を離れ、その加護は神話遺物の加護に置き換わります（図鑑の登録は残ります）。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>
                やめる
              </Button>
              <Button onClick={() => craft(confirm)}>
                <Hexagon /> 錬成する
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {ritual && <CraftRitual mythic={ritual} onClose={() => setRitual(null)} />}
      {dissolved && <DissolveRitual {...dissolved} onClose={() => setDissolved(null)} />}
    </div>
  );
}

type Dissolved = { item: Item; amount: number; gained: number; total: number };

/** 還元の儀: 遺物がほどけて星屑となって沈み、原石が姿を現す。何度も行うものなので錬成より短く */
function DissolveRitual({ item, amount, gained, total, onClose }: Dissolved & { onClose: () => void }) {
  const label = item.kind === "fragment" ? item.name : `『${item.name}』`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[min(24rem,calc(100%-2rem))]! gap-3 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-6 ring-aqua/25 backdrop-blur-2xl short:p-4">
        <p className="text-center font-display text-[10px] tracking-[0.5em] whitespace-nowrap text-aqua/70">
          <span className="-mr-[0.5em]">DISSOLUTION</span>
        </p>
        <div className="relative mx-auto aspect-square w-full max-w-48 short:max-w-36">
          {/* ほどける遺物 */}
          <div className="dissolve-item absolute inset-[22%]">
            <ItemArt icon={item.svgIcon} rarity={item.rarity} color={item.color} seed={item.id} className="size-full" />
          </div>
          {/* 星屑となって沈んでいく */}
          <svg viewBox="-50 -50 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {Array.from({ length: 14 }, (_, i) => {
              const x = ((i * 37) % 60) - 30;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={-14 + ((i * 23) % 24)}
                  r={0.8 + (i % 3) * 0.4}
                  className="dissolve-mote fill-aqua"
                  style={{ "--i": i, "--dx": `${-x * 0.8}px` } as CSSProperties}
                />
              );
            })}
          </svg>
          {/* 凝り固まった原石 */}
          <div className="dissolve-ore absolute inset-[26%]">
            <ItemArt icon={STARDUST_ORE.svgIcon} rarity="C" color={STARDUST_ORE.color} seed={STARDUST_ORE.id} className="size-full" />
          </div>
        </div>
        <div className="dissolve-caption flex flex-col items-center gap-1 text-center">
          <DialogTitle className="text-sm tracking-[0.2em] [word-break:auto-phrase]">
            {label}
            {amount > 1 && <span className="ml-1 font-display">×{amount}</span>}
            を還元した
          </DialogTitle>
          <p className="font-display text-3xl text-aqua text-glow-aqua">+{gained}</p>
          <DialogDescription className="text-xs tracking-wider">
            {STARDUST_ORE.name}　所持 <span className="font-display text-foreground">{total}</span>
          </DialogDescription>
          <Button className="mt-2" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecipeCard({ mythic, data, onCraft }: { mythic: RelicItem; data: UserData; onCraft: () => void }) {
  const crafted = (data.inventory[mythic.id] ?? 0) > 0;
  const ready = canCraft(data, mythic);
  const ore = oreCount(data);
  const need = mythic.recipe!.ore;

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border p-3",
        crafted ? "border-starlight/40 bg-starlight/[0.04] shadow-[0_0_18px_-8px_rgba(226,201,116,0.6)]" : "border-white/10 bg-black/15",
      )}
    >
      <div className="flex items-center gap-2">
        <ItemArt icon={mythic.svgIcon} rarity="SS" color={mythic.color} seed={mythic.id} locked={!crafted} className="size-12 shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-[10px] tracking-[0.25em] text-starlight/70">RARE SS · 神話</p>
          <p className="text-sm tracking-[0.12em]">『{mythic.name}』</p>
          <p className="text-[11px] tracking-wider text-aqua [word-break:auto-phrase]">{mythic.effect}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 text-[11px] tracking-wider">
        <Requirement met={crafted || ore >= need}>
          星屑の原石 <span className="font-display">{Math.min(ore, need)} / {need}</span>
        </Requirement>
        {recipeRelics(mythic).map((relic) => (
          <Requirement key={relic.id} met={crafted || (data.inventory[relic.id] ?? 0) > 0}>
            『{relic.name}』
            <span className="ml-1 font-display text-[9px] text-muted-foreground">{relic.rarity}</span>
          </Requirement>
        ))}
      </ul>
      <div className="mt-auto">
        {crafted ? (
          <p className="text-center text-[11px] tracking-[0.2em] text-starlight">錬成済み・加護が働いています</p>
        ) : (
          <Button size="sm" className={cn("w-full", ready && "claim-glow")} disabled={!ready} onClick={onCraft}>
            <Hexagon /> 錬成する
          </Button>
        )}
      </div>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5", met ? "text-foreground" : "text-muted-foreground")}>
      {met ? <Check className="size-3 shrink-0 text-aqua" /> : <X className="size-3 shrink-0 text-white/25" />}
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** 錬成の儀: 1px の幾何学ラインが描き起こされて交差し、閃光ののちに神話遺物が姿を現す */
function CraftRitual({ mythic, onClose }: { mythic: RelicItem; onClose: () => void }) {
  const color = mythic.color;
  // 描き起こす線は pathLength で長さを揃えるため、non-scaling-stroke（破線が画面座標で計算される）を使わず、表示幅で約 1px になる太さにする
  const hair = { fill: "none", stroke: color, strokeWidth: 0.45, pathLength: 1 } as const;
  const triangle = (offset: number) =>
    Array.from({ length: 3 }, (_, i) => {
      const a = ((offset + i * 120 - 90) * Math.PI) / 180;
      return `${(Math.cos(a) * 40).toFixed(2)},${(Math.sin(a) * 40).toFixed(2)}`;
    }).join(" ");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[min(28rem,calc(100%-2rem))]! gap-3 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-6 ring-starlight/25 backdrop-blur-2xl short:p-4">
        <p className="text-center font-display text-[10px] tracking-[0.5em] whitespace-nowrap text-starlight/70">
          <span className="-mr-[0.5em]">TRANSMUTATION</span>
        </p>
        <div className="relative mx-auto aspect-square w-full max-w-64 short:max-w-44">
          <svg viewBox="-50 -50 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            {/* 錬成陣が内から外へ描き起こされる */}
            <g>
              {[46, 40, 22].map((r, i) => (
                <circle key={r} r={r} {...hair} className="craft-line" style={{ "--i": i } as CSSProperties} strokeOpacity={0.7} />
              ))}
              <polygon points={triangle(0)} {...hair} className="craft-line" style={{ "--i": 3 } as CSSProperties} />
              <polygon points={triangle(60)} {...hair} className="craft-line" style={{ "--i": 4 } as CSSProperties} />
            </g>
            {/* 回りながら交差する光の線 */}
            <g className="craft-cross">
              {[0, 30, 60, 90, 120, 150].map((deg) => (
                <line key={deg} x1="-48" x2="48" stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeOpacity={0.55} transform={`rotate(${deg})`} />
              ))}
            </g>
            {/* 交点に集まる閃光 */}
            <circle r="14" fill={color} className="craft-flash" />
          </svg>
          <div className="craft-reveal absolute inset-[24%]">
            <ItemArt icon={mythic.svgIcon} rarity="SS" color={color} seed={mythic.id} className="size-full" />
          </div>
        </div>
        <div className="craft-caption flex flex-col items-center gap-1 text-center">
          <p className="font-display text-[10px] tracking-[0.3em] text-starlight/70">RARE SS · 神話</p>
          <DialogTitle className="text-lg tracking-[0.25em] whitespace-nowrap" style={{ color, textShadow: `0 0 12px ${color}80` }}>
            『{mythic.name}』
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed tracking-wider [word-break:auto-phrase]">{mythic.flavorText}</DialogDescription>
          <p className="mt-1 text-sm tracking-wider text-aqua">{mythic.effect}</p>
          <Button className="mt-2" onClick={onClose}>
            図鑑に刻む
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
