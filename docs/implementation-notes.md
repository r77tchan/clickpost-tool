# 実装ノート — クリックポスト面付けツール(clickpost-tool)

2026-07-03 に実際のクリックポストPDFを使って動作検証した際に得た知見の記録。
コードを読み解く際・将来別ツールで PDF を扱う際の参照用。

## 1. クリックポストPDFは暗号化されている

- 暗号方式: RC4 128bit(`/Filter /Standard`, `/V 2`, `/R 3`)。閲覧パスワードは無く権限制限のみ(ビューアでは普通に開ける)。
- pdf-lib は `PDFDocument.load(bytes, { ignoreEncryption: true })` で読み込みはできるが、**コンテンツストリームの復号には非対応**。`embedPages()` は `Unknown compression method in flate stream` エラーで失敗する(暗号化されたままの zlib ストリームを解凍しようとするため)。
- ページサイズ・ページ数などのメタデータ(辞書の数値)は暗号化されないため読める。

**採用した方式**: 復号に対応した pdfjs(pdfjs-dist)でラベル領域(ページ左上 1/4 = 105×148.5mm)を **600dpi でレンダリング**し、PNG として pdf-lib の `embedPng` + `drawImage` で**原寸配置**する。ベクターは維持できないが、600dpi あればバーコード・QR とも印刷品質は十分。

- 出力サイズ実測: 1面 約470KB、4面 約1.9MB。

## 2. pdfjs の同梱アセットが必須(特に日本語)

宛名ラベルのテキストは MS-Gothic / MS-PGothic(非埋め込みの CID フォント)。**CMap(90ms-RKSJ 等)が無いと文字が一切描画されない**(バーコード・枠だけのラベルになる)。

- `node_modules/pdfjs-dist` の `cmaps/`・`standard_fonts/`・`wasm/`(JBIG2/JPEG2000 画像デコーダ、qcms)・`iccs/` を **postinstall**(`scripts/copy-pdfjs-assets.mjs`)で `public/pdfjs/` にコピーして静的配信する。`public/pdfjs` はコミットしない(.gitignore 済み)。
- `getDocument()` に `cMapUrl` / `cMapPacked: true` / `standardFontDataUrl` / `wasmUrl` / `iccUrl` を指定する。
- 「Cannot load system font: MS-Gothic」警告は、フォールバックフォントで描画されるだけなので実害なし。

## 3. worker まわりの落とし穴(3連発)

1. **Vite dev サーバーは node_modules 内の巨大 module worker(pdf.worker.min.mjs 1.26MB)の変換で固まることがある**(リクエストが pending のまま返らない)。→ worker も `public/pdfjs/` から無変換で静的配信する。ビルドのチャンク肥大警告も解消される。
2. **ブラウザ拡張などが `new Worker(url)` のスクリプトリクエストをインターセプトして固まる環境がある**(fetch は正常なのに Worker のロードだけ pending になる)。→ worker スクリプトを fetch して **Blob URL** から起動する(`reader.ts` の `ensureWorkerSrc()`)。
3. **Blob URL の worker 内ではルート相対パス(`/skym-tools/...`)の fetch が「URLパース失敗」になる**(ベースが `blob:` のため)。→ `cMapUrl` 等のアセットURLは `new URL(base, location.href).href` で**絶対URL**にして渡す。

## 4. バックグラウンドタブでレンダリングが完了しない問題

- pdfjs のレンダリングは `intent: 'display'`(デフォルト)だと `requestAnimationFrame` で描画を継続する。**非表示タブ/背面ウィンドウでは rAF が停止するため、render の Promise が永遠に解決しない**(worker 側の `getOperatorList` は正常完了する — 詰まるのはメインスレッドの描画フェーズ)。
- → **`intent: 'print'` を指定**すると rAF に依存しなくなる。印刷用途なので品質面でも妥当。

## 5. 検証結果(実PDF・実ブラウザ)

- 出力PDF: A4 = 595.28×841.89pt ちょうど。各スロット 105×148.5mm 原寸配置で、元PDFの切り取り線がスロット境界に正確に一致(= A-one 77220 の面割りに一致)。
- 1件配置(任意スロット)・4件フル配置・スロット間の移動/入れ替え・削除、いずれも動作確認済み。
- 印刷ボタン(hidden iframe 方式)はブラウザの印刷ダイアログを開くところまで実装(実プリンタでの印刷はユーザー確認待ち)。
- **印刷時は倍率「実際のサイズ(100%)」必須**(拡大縮小されるとシール枠とずれる)。

## 6. 切り取り線(v2)

- **元PDF由来の切り取り線の除去**: ラベル領域(左上1/4)の右端・下端の境界線上に破線+ハサミが印字されている。レンダリング後の canvas に対し、右端・下端の帯(`TRIM_RIGHT_MM` / `TRIM_BOTTOM_MM` = 各4mm)を白で `fillRect` して消す(`reader.ts` の `eraseOriginalCutMarks`)。ラベル本体の赤枠は境界から5mm以上内側にあるため影響しない。**位置・サイズは一切変えない**(クロップして再配置する方式は不採用 — 要件は「点線部分以外の表示は変えない」)。
- **自前の十字切り取り線**: `composeSheet` の `cutLines` オプション。pdf-lib の `drawLine`(`dashArray: [2mm, 2mm]`、太さ0.5pt、グレー)で A4 の縦横中央に端から端まで描画。必ず4分割になる。UI のチェックボックスは初期OFF。

## 7. 配布用シングルHTMLビルド(v2)

`npm run build:single`(`vite build --mode single`)で `dist-single/index.html` 1ファイル(約2.4MB)を生成。file:// のダブルクリック起動で動くよう、**実行時のネットワーク取得を完全にゼロ**にしている(http 配信でリクエストが data: URL のみになることを実測確認)。

- `vite-plugin-singlefile` で JS/CSS をインライン化。single モードでは `base: './'`、`assetsInlineLimit` 最大化、`copyPublicDir: false`。
- ビルドフラグ `__SINGLE_FILE__`(vite の `define`)で reader.ts のアセット供給を分岐。Pages 版のバンドルには dead code elimination により worker の `?raw` 文字列(1.26MB)は混入しない(動的 import + フラグ分岐のため)。
- **worker**: `pdfjs-dist/build/pdf.worker.min.mjs?raw` を動的 import して文字列として埋め込み、Blob URL で起動(§3 の方式を流用)。
- **CMap**: 必要な5つの .bcmap(90ms-RKSJ-H/V, 90msp-RKSJ-H/V, Adobe-Japan1-UCS2 — 実測+保険)を `?url` import + `assetsInlineLimit` で data URL 化して埋め込み。
  - pdfjs **v6 では旧 `CMapReaderFactory` / `StandardFontDataFactory` が `BinaryDataFactory` に統合**されている。`fetch({ kind, filename })` 形式(kind は 'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl'、filename は拡張子付き)。
  - `useWorkerFetch: false` を指定しないと worker が直接 fetch しようとして factory が使われないので注意。
- **standard_fonts / wasm**: クリックポストPDFでは実測でリクエストされないため埋め込まない(要求されたら factory が throw し、pdfjs は警告してフォールバック描画する)。
- 未対応のCMapを使うPDFが来た場合は「CMap「◯◯」は埋め込まれていません」エラーで読み込み失敗になる(Pages 版は全CMapを配信しているため影響なし)。

## 8. 印刷は PDF を経由しない(file:// 対応)

当初の「印刷」は生成PDFを非表示 iframe に読み込んで `contentWindow.print()` を呼ぶ方式だったが、
**file:// で開いたシングルHTML版では Blob URL のオリジンが不透明(null origin)扱いになり、
iframe の contentWindow へのアクセスがクロスオリジン制約でブロックされて印刷できない**
(ユーザー報告により発覚)。

対応: ページ自身に**印刷専用レイアウト**(`App.tsx` の `.print-sheet`)を持たせ、`window.print()`
を呼ぶ方式に変更。iframe も PDF も介さないためオリジン制約を受けず、file:// でも http(s) でも同一に動く。

- 画面UIのルート要素に Tailwind の `print:hidden`、`.print-sheet` は `@media print` でのみ表示(`index.css`)。
- `@page { size: A4; margin: 0 }` + mm 単位の絶対配置(1面 = 105×148.5mm)。**寸法定義が
  PDF出力(`src/pdf.ts`)と印刷CSS(`src/index.css`)の2箇所にある**ので、変更時は両方を揃えること。
- 各ラベルの原寸PNGは読み込み時に Blob URL(`LoadedLabel.printUrl`)として保持し、
  `.print-sheet` に常時レンダリングしておく(印刷時にロード待ちが発生しない)。削除時に revoke。
- 切り取り線は `background`(repeating-linear-gradient)ではなく **border の dashed で描く**
  (Chrome の印刷設定「背景のグラフィック」がOFFでも印字されるように)。
- 検証: `.print-sheet` を単体HTML化し headless Chrome の `--print-to-pdf`(`window.print()` と
  同一パイプライン・同一 `@media print` CSS)で出力 → A4 原寸(誤差0.1mm未満)・面位置・十字破線を確認済み。
