# QRコード作成ツール（004-qr-code-generator）

テキストやURLを入力するだけでQRコードを生成できる、完全クライアントサイドの無料ツールです。

## 特徴

- 外部ライブラリ・CDN不使用。QRコードのエンコード処理（`qrcode-lib.js`）はJIS X 0510 / ISO 18004準拠で自作。
- byteモード(UTF-8)で日本語を含む任意のテキスト・URLに対応。numeric/alphanumericモードも自動選択して符号量を最適化。
- バージョン1〜40を自動選択、誤り訂正レベル(L/M/Q/H)を選択可能。
- マスクパターン0〜7をペナルティ評価で自動選択。
- Canvasへの描画、PNG/SVGダウンロードに対応。
- データは一切サーバーに送信・保存されません（完全オフライン動作・PWA対応）。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | ページ本体。`#tool-root`配下にQR作成UIを実装。 |
| `style.css` | テーマ・レスポンシブ共通スタイル。 |
| `app.js` | UI制御・Canvas描画・PNG/SVGダウンロード処理。 |
| `qrcode-lib.js` | QRコードエンコーダ本体（自作・外部依存なし）。 |
| `monetization.js` | 収益3レール（AdSense/アフィリエイト/Stripe）管理。 |
| `manifest.webmanifest` / `sw.js` | PWA対応。 |
| `privacy.html` / `terms.html` / `operator.html` | 法務ページ。 |

## 動作確認

`index.html`をブラウザで開き、テキスト/URLを入力するとQRコードが自動生成されます。
誤り訂正レベル・サイズ・余白・色を変更すると即時再生成されます。
