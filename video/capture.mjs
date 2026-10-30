// 予告編ページ（/trailer）を1コマずつ撮って、縦長 1080×1920・30fps の MP4 に書き出す。
// 先にアプリの開発サーバー（npm run dev）を立ち上げておくこと。
//
//   node capture.mjs                      全体を撮る（音 → 映像 → 合わせる。約12分）
//   node capture.mjs --from 30 --to 42    30〜42秒の区間だけ撮り直し、前回の映像に差し替える（全体の尺を変えたときは使えない）
//   node capture.mjs --audio-only         音だけ録り直し、前回の映像と合わせる（約1分半）
//   node capture.mjs --video-only         映像だけ撮り直し、前回の音と合わせる
//   node capture.mjs --stills 2.5,36,60   指定した秒の静止画だけを out/stills/ に撮る（確認用）
//   共通: [--url http://localhost:3000/trailer] [--out out/maholog-trailer.mp4] [--fps 30]
//
// 1. 音: ページ内でアプリと同じ合成の曲・効果音を実時間で鳴らして録る
// 2. 映像: ページの時刻を 1/fps 秒ずつ進め、CSS アニメーションも同じ時刻に止めて撮る
// 3. 映像と音を合わせる（音量は SNS で聞き取りやすい -16 LUFS に整える）
// 前回の音（*.audio.webm）と音なしの映像（*.video.mp4）を残しておき、部分的な撮り直しに使う
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { chromium } from "playwright-core";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/trailer" },
    out: { type: "string", default: "out/maholog-trailer.mp4" },
    fps: { type: "string", default: "30" },
    chrome: { type: "string", default: "C:/Program Files/Google/Chrome/Application/chrome.exe" },
    from: { type: "string" },
    to: { type: "string" },
    "audio-only": { type: "boolean", default: false },
    "video-only": { type: "boolean", default: false },
    stills: { type: "string" },
  },
});
const fps = Number(values.fps);
const out = resolve(values.out);
mkdirSync(dirname(out), { recursive: true });
const silent = out.replace(/\.mp4$/, ".video.mp4");
const audioFile = out.replace(/\.mp4$/, ".audio.webm");
const ranged = values.from !== undefined || values.to !== undefined;

const ENCODE = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

function ffmpeg(args, input) {
  return new Promise((ok, fail) => {
    const p = spawn(ffmpegPath, ["-y", "-loglevel", "error", ...args], { stdio: [input ? "pipe" : "ignore", "inherit", "inherit"] });
    p.on("error", fail);
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`))));
    if (input) input(p.stdin);
  });
}

function need(file, what) {
  if (!existsSync(file)) {
    console.error(`${what}（${file}）がありません。先に全体を撮ってください: node capture.mjs`);
    process.exit(1);
  }
}

/** 予告編ページを開き、撮影の準備を整える */
async function openTrailer(scale) {
  const browser = await chromium.launch({
    executablePath: values.chrome,
    args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"],
  });
  // 540×960 の画面を2倍の密度で描き、1080×1920 で撮る
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: scale });
  await page.goto(`${values.url}${values.url.includes("?") ? "&" : "?"}capture`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__trailer !== undefined);
  await page.evaluate(() => document.fonts.ready);
  // 開発サーバーの表示（左下の Next.js のバッジなど）を映さない
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const duration = await page.evaluate(() => window.__trailer.duration);
  return { browser, page, duration };
}

async function recordAudio(page) {
  console.log("音を録っています…");
  const audio = await page.evaluate(() => window.__trailer.recordAudio());
  writeFileSync(audioFile, Buffer.from(audio, "base64"));
}

/** コマ [start, end) を撮って file に書き出す */
async function captureFrames(page, start, end, file) {
  console.log(`映像を撮っています…（${(start / fps).toFixed(1)}〜${(end / fps).toFixed(1)}秒、${end - start} コマ）`);
  let writer;
  const encoding = ffmpeg(["-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", ...ENCODE, file], (stdin) => (writer = stdin));
  for (let i = start; i < end; i++) {
    await page.evaluate((t) => window.__trailer.seek(t), (i * 1000) / fps);
    const png = await page.screenshot({ type: "png" });
    if (!writer.write(png)) await new Promise((r) => writer.once("drain", r));
    if ((i - start) % fps === 0) process.stdout.write(`\r  ${Math.round(((i - start) / (end - start)) * 100)}%`);
  }
  writer.end();
  await encoding;
  process.stdout.write("\r  100%\n");
}

/** 前回の映像のコマ [start, end) を、撮り直した区間 segment で差し替える */
async function splice(segment, start, end) {
  console.log("撮り直した区間を差し替えています…");
  const next = silent.replace(/\.video\.mp4$/, ".video.next.mp4");
  await ffmpeg([
    "-i", silent,
    "-i", segment,
    "-filter_complex",
    `[0:v]trim=end_frame=${start},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[0:v]trim=start_frame=${end},setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1[v]`,
    "-map", "[v]",
    "-r", String(fps),
    ...ENCODE,
    next,
  ]);
  rmSync(segment);
  renameSync(next, silent);
}

async function mux(duration) {
  console.log("映像と音を合わせています…");
  await ffmpeg([
    "-i", silent,
    "-i", audioFile,
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "copy",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ar", "48000",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", String(duration / 1000),
    out,
  ]);
  console.log(`書き出しました: ${out}`);
}

// ---- 静止画だけ ----
if (values.stills) {
  const { browser, page } = await openTrailer(2);
  const dir = join(dirname(out), "stills");
  mkdirSync(dir, { recursive: true });
  for (const sec of values.stills.split(",").map(Number)) {
    await page.evaluate((t) => window.__trailer.seek(t), sec * 1000);
    const file = join(dir, `${sec}s.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
  process.exit(0);
}

const { browser, page, duration } = await openTrailer(2);
const total = Math.round((duration / 1000) * fps);

if (values["audio-only"]) {
  need(silent, "前回の映像");
  await recordAudio(page);
} else if (ranged) {
  need(silent, "前回の映像");
  need(audioFile, "前回の音");
  const start = Math.max(0, Math.round(Number(values.from ?? 0) * fps));
  const end = Math.min(total, Math.round(Number(values.to ?? duration / 1000) * fps));
  if (end <= start) {
    console.error("--from は --to より前の秒にしてください");
    process.exit(1);
  }
  const segment = silent.replace(/\.video\.mp4$/, ".segment.mp4");
  await captureFrames(page, start, end, segment);
  await splice(segment, start, end);
} else {
  if (values["video-only"]) need(audioFile, "前回の音");
  else await recordAudio(page);
  await captureFrames(page, 0, total, silent);
}

await browser.close();
await mux(duration);
