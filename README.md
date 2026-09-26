# GOLAZO

試合動画のワンシーンを切り抜き、頭にポスター風のオープニング（約4秒）を付けて1本にするPWA。
オープニングは写真（1〜5枚、人物を自動で切り抜き）と文字を自由に変えられる。
動画の編集（マーク・ズーム・スロー・テロップ）は MATCHCUT と同じ。読み込み・切り抜き・書き出しはすべて端末内で行い、外部へは送信しない。

- 使う: https://satoshiatr-blip.github.io/golazo/ （Safariで開き「ホーム画面に追加」）
- 技術: Vite + React + TypeScript + Tailwind CSS、[mediabunny](https://github.com/Vanilagy/mediabunny)（WebCodecs）、[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter)（人物切り抜き、`selfie_multiclass_256x256` を `public/mediapipe/` に同梱）

## 同梱素材

- 書体: Yuji Boku（ポスター版）、Dela Gothic One（高柳FC版）。どちらも SIL Open Font License 1.1、`public/fonts/` にライセンス文と一緒に置いている（woff2に変換済み）
- `public/tfc-logo.png`: 高柳FCのエンブレム（低解像度の画像から描き直したもの）

## 開発

```bash
npm install
npm run dev -- --mode pc   # PCのブラウザで確認（http://localhost:5187）
npm run dev                # iPhone実機でLAN越しに確認（https、port 5186）
```

MediaPipe を更新したら `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.*` と `vision_wasm_nosimd_internal.*` を `public/mediapipe/` へコピーし直す。

## デプロイ

`npm run build` → `dist/` を `gh-pages` ブランチへ push（GitHub Pages）。
