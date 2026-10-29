"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { onWorldlinePulse, useWorldlinePulseSource, type PulseEvent } from "@/lib/worldline-store";

type Pulse = PulseEvent & { id: number; top: number };

const COLOR = { start: "#71e2ef", finish: "#e2c974" } as const;
const PULSE_MS = 4200;

/**
 * 結ばれた相手が詠唱を始めた・終えたときだけ、背景に細い光が一筋静かに走る。
 * 誰の世界線かは、消えていく小さな添え書きでだけ伝える
 */
export function WorldlinePulses() {
  useWorldlinePulseSource();
  const [pulses, setPulses] = useState<Pulse[]>([]);

  useEffect(() => {
    let nextId = 0;
    return onWorldlinePulse((e) => {
      const pulse = { ...e, id: nextId++, top: 18 + Math.random() * 64 };
      setPulses((list) => [...list.slice(-2), pulse]);
      window.setTimeout(() => setPulses((list) => list.filter((p) => p.id !== pulse.id)), PULSE_MS);
    });
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-[4] overflow-hidden" aria-hidden>
        {pulses.map((p) => (
          <span key={p.id} className="worldline-sweep" style={{ top: `${p.top}%`, "--pulse-color": COLOR[p.kind] } as CSSProperties} />
        ))}
      </div>
      <div className="pointer-events-none fixed right-4 bottom-3 z-30 flex flex-col items-end gap-1" role="status">
        {pulses.map((p) => (
          <p key={p.id} className="worldline-note text-[10px] tracking-[0.25em] whitespace-nowrap" style={{ color: `${COLOR[p.kind]}b0` }}>
            {p.name ?? "結ばれた世界線"}
            {p.kind === "start" ? " の世界線に詠唱の灯がともりました" : " の世界線で詠唱が結実しました"}
          </p>
        ))}
      </div>
    </>
  );
}
