"use client";

import { useEffect, useState, type CSSProperties } from "react";

// 夜空の深層に、別の世界線で詠唱を続ける探究者の気配が時折灯っては消える。
// 配置はクライアントでのみ生成する（SSR とずれないよう初期表示は空）。

type Echo = { id: number; left: number; top: number; world: number; status: string; color: string; life: number };

const STATUSES = ["詠唱中", "星を観測中", "古文書を紐解いている", "静かに瞑想中", "秘術を探究中"];
const COLORS = ["#71e2ef", "#b9a2f7", "#e2c974", "#cfe9ff"];
const MAX_ECHOES = 3;

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** パネルに覆われていない夜空の位置（%）。隙間（data-open-sky の要素の地）にだけ灯す */
function openSkyPoint() {
  for (let i = 0; i < 12; i++) {
    const left = 4 + Math.random() * 92;
    const top = 4 + Math.random() * 92;
    const hit = document.elementFromPoint((window.innerWidth * left) / 100, (window.innerHeight * top) / 100);
    if (!hit || hit.tagName === "MAIN" || hit.hasAttribute("data-open-sky") || hit === document.body) return { left, top };
  }
  return null;
}

export function WorldlineEchoes() {
  const [echoes, setEchoes] = useState<Echo[]>([]);

  useEffect(() => {
    let nextId = 0;
    let timer: number;
    const spawn = () => {
      const point = openSkyPoint();
      setEchoes((list) =>
        !point || list.length >= MAX_ECHOES
          ? list
          : [
              ...list,
              {
                id: nextId++,
                ...point,
                world: 100 + Math.floor(Math.random() * 900),
                status: pick(STATUSES),
                color: pick(COLORS),
                life: 7 + Math.random() * 5,
              },
            ],
      );
      timer = window.setTimeout(spawn, 4000 + Math.random() * 6000);
    };
    timer = window.setTimeout(spawn, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const remove = (id: number) => setEchoes((list) => list.filter((e) => e.id !== id));

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden>
      {echoes.map((e) => (
        <div
          key={e.id}
          className="worldline group pointer-events-auto absolute flex size-5 -translate-1/2 items-center justify-center"
          style={{ left: `${e.left}%`, top: `${e.top}%` }}
        >
          <span
            className="worldline-dot relative size-[3px] rounded-full"
            style={{ background: e.color, color: e.color, boxShadow: `0 0 6px 1px ${e.color}`, "--life": `${e.life}s` } as CSSProperties}
            onAnimationEnd={(ev) => ev.animationName === "worldline-pulse" && remove(e.id)}
          />
          <span
            className={`pointer-events-none absolute top-1/2 ${e.left > 70 ? "right-full mr-1" : "left-full ml-1"} -translate-y-1/2 text-[10px] tracking-[0.2em] whitespace-nowrap rounded bg-midnight/70 px-1.5 py-0.5 text-foreground/55 opacity-0 backdrop-blur-sm transition-opacity duration-700 group-hover:opacity-100`}
          >
            <span className="font-display">世界線 #{e.world}</span> — {e.status}
          </span>
        </div>
      ))}
    </div>
  );
}
