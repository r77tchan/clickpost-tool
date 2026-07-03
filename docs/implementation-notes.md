# 実装ノート — クリックポスト面付けツール

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
