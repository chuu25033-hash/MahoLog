"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { userActions } from "@/lib/user-store";

/** デモモード表示エリアに控えめに置く、観測データの初期化・サンプル読み込み */
export function DemoDataControls() {
  const [open, setOpen] = useState(false);

  // 各画面が保存データを読み直すよう、操作後は再読み込みする
  function apply(action: () => void) {
    action();
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-3 text-[11px] tracking-wider text-starlight/55 underline-offset-4 hover:text-starlight hover:underline"
      >
        観測データの初期化
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-wider">観測データの初期化</DialogTitle>
            <DialogDescription>
              この端末に保存した詠唱履歴・累積MP・所持アイテム・星天の導きの受取状況を書き換えます。元に戻すことはできません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => apply(userActions.loadSample)}>
              サンプルデータを読み込む
            </Button>
            <Button variant="destructive" onClick={() => apply(userActions.reset)}>
              初期状態に戻す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
