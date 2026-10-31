"use client";

// 結びし世界線の取得・接続と、結ばれた相手の詠唱の開始・完了の知らせ。
// Supabase 接続時は DB（RPC + Realtime）、デモモードは端末内の模擬の相手を使う。
import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { isEmailAuthMode } from "./supabase/config";
import { userActions, useUserData } from "./user-store";
import { simulatedName, simulatedPresence, type Bond, type Presence } from "./worldlines";

export type BindResult = "accepted" | "pending" | "exists" | "self" | "not_found" | "error";

export type PulseEvent = { kind: "start" | "finish"; name: string | null };

export type WorldlinesView = {
  myCode: string | null;
  bonds: Bond[];
  loading: boolean;
  error: string | null;
  /** 気配の「〜分前」を測る現在時刻（30秒ごとに進む） */
  now: number;
  bind: (code: string) => Promise<BindResult>;
  accept: (bond: Bond) => Promise<void>;
  unbind: (bond: Bond) => Promise<void>;
};

// ---------------------------------------------------------------------
// 光のパルスの知らせ
// ---------------------------------------------------------------------
const pulseListeners = new Set<(e: PulseEvent) => void>();

function emitPulse(e: PulseEvent) {
  pulseListeners.forEach((l) => l(e));
}

export function onWorldlinePulse(listener: (e: PulseEvent) => void) {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------
// 30秒ごとに進む時計（気配の経過時間・模擬の相手の周期に使う）
// ---------------------------------------------------------------------
const CLOCK_MS = 30_000;
let clockNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: number | null = null;

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer === null) {
    clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, CLOCK_MS);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

const clockSnapshot = () => clockNow || Date.now();

function useClockNow() {
  return useSyncExternalStore(subscribeClock, clockSnapshot, () => 0);
}

// ---------------------------------------------------------------------
// デモモード: 端末内の模擬の相手
// ---------------------------------------------------------------------
function useDemoWorldlines(): WorldlinesView {
  const data = useUserData();
  const now = useClockNow();
  const bonds: Bond[] = data.worldlines.bonds.map((b) => ({
    id: b.code,
    code: b.code,
    name: simulatedName(b.code),
    status: "accepted",
    partnerId: null,
    presence: simulatedPresence(b.code, now || undefined),
    simulated: true,
  }));
  return {
    myCode: data.worldlines.code,
    bonds,
    loading: false,
    error: null,
    now,
    bind: async (code) => userActions.bindWorldline(code),
    accept: async () => {},
    unbind: async (bond) => userActions.unbindWorldline(bond.code),
  };
}

/** デモモード: 模擬の相手が詠唱を始めた・終えた瞬間を、時計の刻みごとに見つけて知らせる */
function useDemoPulses() {
  const data = useUserData();
  const codes = data.worldlines.bonds.map((b) => b.code).join(",");

  useEffect(() => {
    if (!codes) return;
    const previous = new Map<string, boolean>();
    const check = (at: number) => {
      for (const code of codes.split(",")) {
        const chanting = simulatedPresence(code, at).chantingSince !== null;
        const before = previous.get(code);
        if (before !== undefined && before !== chanting) emitPulse({ kind: chanting ? "start" : "finish", name: simulatedName(code) });
        previous.set(code, chanting);
      }
    };
    check(Date.now());
    const id = window.setInterval(() => check(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [codes]);
}

// ---------------------------------------------------------------------
// Supabase: RPC で一覧・接続、Realtime で結ばれた相手の気配の変化を受け取る
// ---------------------------------------------------------------------
type RemoteState = { myCode: string | null; bonds: Bond[]; loading: boolean; error: string | null };

type BondRow = {
  bond_id: string;
  direction: "outgoing" | "incoming";
  status: "pending" | "accepted";
  partner_id: string | null;
  username: string | null;
  worldline_code: string;
  chanting_since: string | null;
  last_chant_at: string | null;
  current_stage_id: string | null;
};

type ProfileRow = { id: string; chanting_since: string | null; last_chant_at: string | null; current_stage_id: string | null };

let remote: RemoteState = { myCode: null, bonds: [], loading: true, error: null };
const remoteListeners = new Set<() => void>();
let remoteStarted = false;
let channel: RealtimeChannel | null = null;

function setRemote(patch: Partial<RemoteState>) {
  remote = { ...remote, ...patch };
  remoteListeners.forEach((l) => l());
}

function toBond(row: BondRow): Bond {
  const accepted = row.status === "accepted";
  return {
    id: row.bond_id,
    code: row.worldline_code,
    name: row.username,
    status: accepted ? "accepted" : row.direction,
    partnerId: row.partner_id,
    presence: accepted ? { chantingSince: row.chanting_since, lastChantAt: row.last_chant_at, stageId: row.current_stage_id } : null,
  };
}

function onProfileChange(row: ProfileRow) {
  const bond = remote.bonds.find((b) => b.partnerId === row.id);
  if (!bond) return;
  const prev = bond.presence;
  const next: Presence = { chantingSince: row.chanting_since, lastChantAt: row.last_chant_at, stageId: row.current_stage_id };
  if (next.chantingSince && !prev?.chantingSince) emitPulse({ kind: "start", name: bond.name });
  else if (next.lastChantAt && next.lastChantAt !== prev?.lastChantAt) emitPulse({ kind: "finish", name: bond.name });
  setRemote({ bonds: remote.bonds.map((b) => (b === bond ? { ...b, presence: next } : b)) });
}

async function refreshRemote() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) {
    setRemote({ loading: false, error: "ログインが必要です" });
    return;
  }
  const [bonds, me] = await Promise.all([
    supabase.rpc("get_worldline_bonds"),
    supabase.from("profiles").select("worldline_code").eq("id", userId).single(),
  ]);
  if (bonds.error || me.error) {
    setRemote({ loading: false, error: "世界線の観測に失敗しました" });
    return;
  }
  const list = (bonds.data as BondRow[]).map(toBond);
  setRemote({ myCode: me.data.worldline_code, bonds: list, loading: false, error: null });

  // 結ばれた相手の行だけを購読する（RLS で相手の行しか届かない）
  const ids = list.flatMap((b) => (b.partnerId ? [b.partnerId] : []));
  if (channel) await supabase.removeChannel(channel);
  channel = null;
  if (ids.length === 0) return;
  channel = supabase
    .channel("bound-worldlines")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=in.(${ids.join(",")})` },
      (payload) => onProfileChange(payload.new as ProfileRow),
    )
    .subscribe();
}

function subscribeRemote(listener: () => void) {
  remoteListeners.add(listener);
  if (!remoteStarted) {
    remoteStarted = true;
    void refreshRemote();
  }
  return () => {
    remoteListeners.delete(listener);
  };
}

const remoteSnapshot = () => remote;
const REMOTE_SERVER_SNAPSHOT: RemoteState = { myCode: null, bonds: [], loading: true, error: null };

function useRemoteWorldlines(): WorldlinesView {
  const state = useSyncExternalStore(subscribeRemote, remoteSnapshot, () => REMOTE_SERVER_SNAPSHOT);
  const now = useClockNow();
  return {
    ...state,
    now,
    bind: async (code) => {
      const { data, error } = await createClient().rpc("bind_worldline", { target_code: code });
      if (error) return "error";
      await refreshRemote();
      return data as BindResult;
    },
    accept: async (bond) => {
      await createClient().from("friends").update({ status: "accepted" }).eq("id", bond.id);
      await refreshRemote();
    },
    unbind: async (bond) => {
      await createClient().from("friends").delete().eq("id", bond.id);
      await refreshRemote();
    },
  };
}

/** Supabase: 購読を始めておくだけ（知らせは onProfileChange から届く） */
function useRemotePulses() {
  useSyncExternalStore(subscribeRemote, remoteSnapshot, () => REMOTE_SERVER_SNAPSHOT);
}

/**
 * 結びし世界線を開いているか。本物の相手と結べるのはメール認証モード（DB）だけなので、
 * それ以外では入口を「準備中」として閉じ、端末内の模擬の相手（デモモード）は表に出さない
 */
export const WORLDLINES_OPEN = isEmailAuthMode;

export const useWorldlines: () => WorldlinesView = isEmailAuthMode ? useRemoteWorldlines : useDemoWorldlines;

/**
 * 結ばれた相手の詠唱の開始・完了を onWorldlinePulse へ流す（画面に一つだけ置く）。
 * 閉じている間は、前に模擬の相手と結んでいても光の知らせを流さない
 */
export const useWorldlinePulseSource: () => void = !WORLDLINES_OPEN ? () => {} : isEmailAuthMode ? useRemotePulses : useDemoPulses;

/** 自分の詠唱の開始・中断を、結ばれた相手に気配として残す（デモモードでは何もしない） */
export function setChantPresence(chanting: boolean, stageId?: string) {
  if (!isEmailAuthMode) return;
  void createClient().rpc("set_chant_presence", { chanting, stage_id: stageId ?? null });
}
