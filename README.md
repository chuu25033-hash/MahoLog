# マホログ

> 孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅の記録

勉強時間を「詠唱」として記録する、一人で進める学習記録アプリ。学んだ時間は累積魔力（MP）となり、探求度・魔術階級が上がり、奥地のエリアが開かれていく。順位を競う仕組みは持たない。

## 主な画面

| パス | 画面 | 内容 |
| --- | --- | --- |
| `/` | タイトル | 初回はプロローグを流す。観測者IDから記録を復元できる |
| `/dashboard` | 魔術書庫 | 拠点。初回は各ボタンを巡る案内を出す |
| `/timer` | 詠唱の間 | 律動の詠唱（ポモドーロ）と無窮の詠唱（ストップウォッチ）。計り忘れた詠唱の書き留め |
| `/history` | 魔導の軌跡 | 暦と星の記憶で詠唱を振り返る |
| `/collection` | 魔導図鑑 | 遺物・古代文書・錬成陣 |
| `/zenith` | 星天の塔 | STAGE 6 制覇後に開く、無限に昇る塔 |
| `/settings` | 設定（書斎） | 名前・紋章・科目・音・観測者IDと復元キー・バックアップ |

## データの持ち方

- 記録は端末の localStorage（`maholog_user_data`）に保存する。進行中の詠唱は `maholog_chant_session` に書き留め、画面を閉じても続きから再開できる
- Supabase を設定すると、記録をクラウドに同期する
  - ログインしていなければ観測者ID（`ML-XXXX-XXXX`）と復元キーで預ける
  - Google でログインすればアカウントに預ける
- メール認証＋DB に勉強記録を持つモード（`NEXT_PUBLIC_AUTH_MODE=email`）も残っているが、今は使っていない

## 開発

```bash
npm install
cp .env.example .env.local   # 必要なら Supabase の値を入れる（未設定なら端末だけに保存）
npm run dev                  # http://localhost:3000
npm test                     # vitest
npm run lint
npm run build
```

- 開発サーバーでは設定画面に開発者ツールが出る（データの退避・全解放・復元、詠唱の省略）
- Next.js 16（`cacheComponents` 有効）。API や規約が以前と異なるので、`node_modules/next/dist/docs/` を確かめてから書く（`AGENTS.md`）
- DB の変更は `supabase/migrations/` に置く。継続して使っている人の数は `supabase/queries/engagement.sql` を SQL Editor で実行して測る
- アクセス数は Vercel Analytics で見る
