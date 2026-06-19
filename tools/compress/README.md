# 003-image-compressor（メディア圧縮：画像・動画・音声）

画像・動画・音声をサーバーに送らず、ブラウザ内だけで圧縮するツールです。
画像はCanvas API、動画・音声は同梱の ffmpeg.wasm（単一スレッド版）で処理します。

## 機能

### 共通
- 上部タブで「画像 / 動画 / 音声」モードを切替
- ダーク/ライト切替、レスポンシブ、アクセシビリティ対応
- PWA対応（manifest + sw.js + Service Worker登録）

### 画像モード（従来機能）
- ドラッグ&ドロップ／ファイル選択（複数枚対応）
- 画質スライダー（0.1〜1.0、初期0.7、debounceで再圧縮）
- リサイズ（最大幅・最大高さ、アスペクト比維持、プリセット: 1920/1280/800/原寸/カスタム）
- 出力形式選択（自動=JPEG / JPEG / WebP / PNG）
- EXIF回転を考慮した正しい向きでの処理（`createImageBitmap(file, { imageOrientation: 'from-image' })`、非対応時は`Image`要素にフォールバック）
- 元サイズ・圧縮後サイズ・削減率の表示、個別／すべてダウンロード、クリア

### 動画モード
- 入力: `video/*`（1ファイル）
- 解像度上限: 原寸 / 720p / 480p（高さ基準・アスペクト比維持・拡大なし）
- 品質: 高/標準/低（H.264 CRF 26/30/34）
- **出力: MP4（H.264 / libx264、音声AAC 128k、`+faststart`）**
- 進捗バー、元→圧縮後サイズ・削減率、ダウンロード

### 音声モード
- 入力: `audio/*`（1ファイル）
- ビットレート: 128 / 96 / 64 kbps
- **出力: MP3（libmp3lame）**
- 進捗バー、元→圧縮後サイズ・削減率、ダウンロード

## ffmpeg.wasm（同梱・遅延ロード）

- **単一スレッド版**を採用。SharedArrayBuffer（COOP/COEPヘッダ）が不要で、
  GitHub Pages でもローカル`serve`でも動作する。
- 一式をリポジトリに同梱（`vendor/ffmpeg/`）。実行時に外部CDNへ取りに行かない。
  - `@ffmpeg/ffmpeg@0.11.6`（UMD: `ffmpeg.min.js`）
  - `@ffmpeg/core@0.11.0`（single-thread: `ffmpeg-core.js` / `ffmpeg-core.wasm` / `ffmpeg-core.worker.js`）
  - `createFFmpeg({ corePath: './vendor/ffmpeg/ffmpeg-core.js', log:false })`
- **遅延ロード**: 重いwasmコア（約25MB）はページ初期表示では読み込まない。
  動画/音声モードで初めて圧縮を実行した時に `ffmpeg.load()` する（プログレス表示付き）。
  画像モードと初期表示は従来通り軽量・即時。
- 処理後は `FS('unlink', ...)` で入出力をメモリから解放。

## プライバシー

- 画像・動画・音声データは外部送信・保存しません。すべて端末内（ブラウザ）で処理します。
  動画・音声も同梱のffmpeg.wasmでブラウザ内処理し、外部のサーバー・CDNへ送信しません。
- localStorageに保存するのは画質・リサイズ・出力形式・テーマ設定のみ（メディアデータは含まない）。

## 既知の制約

- 動画・音声はブラウザ内処理のため、大きいファイルほど処理時間・メモリ使用量が増える。
  単一スレッド版のため速度は控えめ。数十MB以下・短尺を推奨。
- 入力形式は端末内ffmpeg.wasmがデコードできる範囲に限られる。
- SWのASSETSにffmpeg vendor（約25MB）は含めない（巨大なため）。SWはネットワーク優先のまま。

## 収益設計（プレースホルダ）

- AdSense: コンテンツ上下に2枠（`monetization.js`の`ADSENSE_CLIENT_ID`未設定）
- アフィリエイト: 「おすすめ」枠（オンラインストレージ・写真管理/編集ソフト想定、`AFFILIATE_ITEMS`未設定）
- Stripe お布施: 任意のご支援（`STRIPE_DONATION_URL`未設定）

## 公開手順（社長作業）

1. GitHub新規リポジトリ `image-compressor` を作成し、GitHub Pagesで公開
2. `index.html`等の`canonical`/OGP URLが実際の公開URLと一致するか確認
3. `operator.html`の運営者情報・特定商取引法に基づく表記を記入
4. AdSense審査申請 → 通過後 `monetization.js`の`ADSENSE_CLIENT_ID`設定とタグ有効化
5. AdSense配信開始に伴うCookie同意（CMP）対応の検討
6. アフィリエイト提携（オンラインストレージ・写真管理ソフト等）→ `AFFILIATE_ITEMS`を実リンクに更新
7. Stripeお布施Link発行 → `STRIPE_DONATION_URL`設定
8. 公開前に開発用「Proフラグを切替（開発用）」ボタンの削除を検討
