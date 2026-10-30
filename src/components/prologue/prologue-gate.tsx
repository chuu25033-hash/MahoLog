"use client";

import type { ReactNode } from "react";
import { usePrologueCompleted } from "@/lib/prologue";
import { Prologue } from "./prologue";

/** 初めて訪れたときだけ、プロローグを見届けてから中身（タイトル画面）を開く */
export function PrologueGate({ children }: { children: ReactNode }) {
  const completed = usePrologueCompleted();
  return completed ? children : <Prologue />;
}
