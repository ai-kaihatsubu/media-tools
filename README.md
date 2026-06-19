# カテゴリ統合アプリ シェルテンプレート — factory/category-suite-template

設定駆動（`config.js`）でタブ＋iframeのカテゴリ統合アプリを量産するためのシェルテンプレートです。
6カテゴリ（お金/日付時間/テキスト/変換/パスワード/メディア）への複製を想定しています。

## 方式

- `config.js` の `window.SUITE_CONFIG` がブランド名・説明・タブ構成（タブ数は可変）を定義する「設定の単一の源」。
- `app.js` が `SUITE_CONFIG` を読み込み、`#tab-bar`（タブボタン群）と `#panels`（iframeパネル群）を動的生成する。
- 各タブは `iframe` で対応するツールの `index.html` を読み込む。
- 初回タブをアクティブ化したタイミングで `iframe` の `src` を遅延セット（最初のタブのみ初期表示時に読み込み）。
- 選択中のタブは `localStorage`（キー: `tf_cat_active`、値はタブのインデックス）に記憶され、次回アクセス時に復元される。

## 構造

```
category-suite-template/
├── config.js            設定の単一の源（brand/desc/tabs）
├── index.html            シェル本体（#tab-bar・#panelsは空、app.jsが生成）
├── style.css             シェルのスタイル（Apple基盤デザイン）
├── app.js                タブ・パネル動的生成・タブ切替・テーマ切替
├── monetization.js       シェルレベルの収益3レール（AdSense/アフィリエイト/Stripe・プレースホルダ）
├── manifest.webmanifest  PWAマニフェスト
├── sw.js                 Service Worker（シェルのみキャッシュ、ネットワーク優先）
├── icons/                シェル用アイコン（自作SVG）
├── privacy.html / terms.html / operator.html  シェルの法務ページ
└── tools/                各ツールをここにコピーする（複製時に追加）
```

## 複製手順

1. このディレクトリ全体を `products/<カテゴリ名>-suite/` 等にコピーする。
2. `tools/` 配下に、対象カテゴリの各ツール（既存products配下のツール一式）をコピーする。
3. `config.js` を編集し、`SUITE_CONFIG` を実際の値に書き換える。
   - `brand`: カテゴリのブランド名（例: "お金ツール置き場"）
   - `desc`: カテゴリの説明文
   - `tabs`: 各ツールの `{ label, path }` をタブ数に応じて列挙
     （`path` は `./tools/<slug>/index.html` 形式）
4. 以下のプレースホルダを、エディタの一括置換（または `sed`）で実際の値に置換する。

### プレースホルダ一覧

| プレースホルダ | 置換内容 | 出現ファイル |
| --- | --- | --- |
| `メディアツール` | ブランド名（例: お金ツール置き場） | index.html, config.js, manifest.webmanifest, privacy/terms/operator.html |
| `画像・動画・音声の圧縮とQRコード作成ができる無料ツール（端末内処理）` | 説明文（meta description等） | index.html, config.js, manifest.webmanifest |
| `メディアツール｜ツール置き場` | ページタイトル（`<title>` / OGP） | index.html |
| `https://ai-kaihatsubu.github.io/media-tools/` | 公開URL（末尾`/`付き。例: `https://example.github.io/money-suite/`） | index.html, privacy/terms/operator.html |
| `media-tools-v1` | Service Workerキャッシュ名（例: `money-suite-v1`） | sw.js |
| `__LABEL1__`〜 | 各タブのラベル | config.js（タブ数に応じて増減可） |
| `__SLUG1__`〜 | 各ツールのディレクトリ名（`tools/<slug>/`） | config.js（タブ数に応じて増減可） |

### sedでの一括置換例（bash）

```bash
cd products/money-suite
sed -i 's/メディアツール/お金ツール置き場/g; s|https://ai-kaihatsubu.github.io/media-tools/|https://example.github.io/money-suite/|g' \
  index.html config.js manifest.webmanifest privacy.html terms.html operator.html
```

## タブ数の変更

`config.js` の `tabs` 配列の要素数を増減するだけで、`app.js` がタブボタン・iframeパネルを
その数に応じて動的生成する。`index.html` 側のid付け・編集は不要。

## プレビューの開き方

```
category-suite-template/index.html
```
をブラウザで開く。`config.js` のサンプルタブ（`__SLUG1__`〜）に対応する
`tools/` 配下の実体は本テンプレには無いため、iframeは404になるが、
タブ生成・切替・`src`の遅延セットの挙動は正しく動作する。

## 注意点（広告枠の二重表示）

内包する各ツールにもそれぞれ広告プレースホルダ枠（`.ad-slot`）が存在する場合、
iframe内とシェルの両方に広告枠が表示され得る。実運用時はシェル側のみに広告を表示し、
各ツールのAdSense設定は無効化することを推奨する。
