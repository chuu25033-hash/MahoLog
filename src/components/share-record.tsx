"use client";

import { WhisperText, whisperHost } from "@/components/whisper";
import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { AvatarGlyph } from "@/components/arcane-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WIZARD_AVATARS } from "@/components/wizard-avatar";
import { canShareImage, downloadBlob } from "@/lib/canvas-card";
import { formatMinutes } from "@/lib/game";
import { renderShareCard, type ShareCardInput } from "@/lib/share-card";

export type ShareRecord = Omit<ShareCardInput, "glyph" | "tint"> & { avatar: string };

function shareText(record: ShareRecord) {
  const week = record.weekMinutes > 0 ? `今週は${formatMinutes(record.weekMinutes)}の詠唱を重ねました。` : "";
  return `「${record.rankTitle}」として秘術を探求中。${week}\n#マホログ`;
}

/** 書庫から、探求の記録を1枚の画像にして SNS に共有する */
export function ShareRecordButton({ record }: { record: ShareRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="icon-sm" onClick={() => setOpen(true)} aria-label="探求の記録を共有" className={whisperHost}>
        <Share2 />
        {/* 枠の右端にあるので、ひとことは右へ寄せる */}
        <WhisperText text="探求の記録を画像にする" className="right-0 left-auto translate-x-0" />
      </Button>
      {open && <ShareRecordDialog record={record} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareRecordDialog({ record, onClose }: { record: ShareRecord; onClose: () => void }) {
  const glyphRef = useRef<SVGSVGElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const preset = WIZARD_AVATARS[record.avatar] ?? WIZARD_AVATARS["wizard-1"];

  // 開いたときに一度だけ描く（記録は開いている間に変わらない）
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    renderShareCard({ ...record, glyph: glyphRef.current, tint: preset.tint })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const file = image ? new File([image.blob], "maholog-record.png", { type: "image/png" }) : null;
  const text = shareText(record);
  const siteUrl = typeof window === "undefined" ? "" : window.location.origin;

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: `${text}\n${siteUrl}` });
    } catch {}
  }

  function postToX() {
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", siteUrl);
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      {/* 画像に描く紋章（画面には出さない）。ダイアログの中身は遅れて描かれ、画像を作る時点で間に合わないので外に置く */}
      <AvatarGlyph avatar={record.avatar} ref={glyphRef} className="hidden" />
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[min(36rem,calc(100%-2rem))]!">
          <DialogHeader>
            <DialogTitle className="tracking-[0.2em]">探求の記録を共有</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              紋章と階級、七夜の魔法陣を1枚の画像にしました。観測者IDや復元キーは載りません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex aspect-[1200/675] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt="探求の記録の画像" className="size-full object-contain" />
            ) : (
              <p className="text-xs tracking-widest text-muted-foreground">{failed ? "画像を描けませんでした" : "記録を描いています…"}</p>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" disabled={!image} onClick={() => image && downloadBlob(image.blob, "maholog-record.png")}>
              <Download /> 画像を保存
            </Button>
            {file && canShareImage(file) ? (
              <Button onClick={share}>
                <Share2 /> 共有する
              </Button>
            ) : (
              <Button onClick={postToX}>X に投稿</Button>
            )}
          </DialogFooter>
          {!(file && canShareImage(file)) && (
            <p className="-mt-2 text-center text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
              X では、保存した画像を投稿画面に添えてください
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
