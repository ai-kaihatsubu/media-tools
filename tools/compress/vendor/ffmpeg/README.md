# vendor/ffmpeg — 同梱 ffmpeg.wasm（単一スレッド版）

動画・音声圧縮を**ブラウザ内だけ**で実行するために、ffmpeg.wasm 一式をローカル同梱している。
実行時に外部CDNへ取りに行かない（`media.js` の `corePath` はこのフォルダを指す）。

## なぜ単一スレッド版か

マルチスレッド版は `SharedArrayBuffer` を使うため COOP/COEP ヘッダが必要だが、
GitHub Pages はヘッダを設定できない。**単一スレッド版はヘッダ不要**で、GitHub Pages でも
ローカルの `serve` でも動作する。

## 同梱ファイル

| ファイル | 取得元 | 用途 |
| --- | --- | --- |
| `ffmpeg.min.js` | `@ffmpeg/ffmpeg@0.11.6`（UMD） | `window.FFmpeg`（createFFmpeg / fetchFile） |
| `ffmpeg-core.js` | `@ffmpeg/core-st@0.11.1`（**single-thread**） | wasmローダ。`SharedArrayBuffer` 不使用 |
| `ffmpeg-core.wasm` | `@ffmpeg/core-st@0.11.1` | ffmpeg本体（約24MB、libx264/libmp3lame/aac 等を内蔵） |
| `ffmpeg-core.worker.js` | `@ffmpeg/core@0.11.0` | スタブ。UMDが無条件にfetchするため配置のみ（st coreはpthreadを起動しないので未使用） |

## 適用済みパッチ（重要）

`ffmpeg.min.js` に1か所だけ手を加えている:

- 変更: `c.mainName||"proxy_main"` → `c.mainName||"main"`
- 理由: UMD@0.11.6 は既定でマルチスレッド core の CLI エントリ `proxy_main` を cwrap するが、
  単一スレッド版 `core-st@0.11.1` は CLI エントリを `main` で公開している。
  既定のままだと `Cannot call unknown function proxy_main` で失敗するため、フォールバックを `main` に変更した。

再取得（更新）する場合はこのパッチを再適用すること。

## corePath を絶対URLで渡す理由（media.js 側）

UMD@0.11.6 は `corePath` が相対パスだと `new URL(corePath, "file:///home/jeromewu/...")` という
ビルド時の固定baseに対して解決してしまい、`file://` URL になって `fetch` に失敗する。
`media.js` では `new URL("./vendor/ffmpeg/ffmpeg-core.js", document.baseURI).href` で
**絶対URL**にしてから渡している。
