# 📮 clickpost-tool — クリックポスト面付けツール

クリックポスト(日本郵便)の宛名ラベルPDFは A4 の左上固定で印字されるため、そのままでは毎回はさみで切り取る必要があります。このツールは、宛名ラベルPDF(最大4件)を読み込み、**A4・4面のシール用紙([A-one 77220](https://www.a-one.co.jp/product/search/detail.php?id=77220) など、105×148.5mm × 4面)の好きな面に配置し直した PDF** を作ります。

すべて**ブラウザ内で完結**し、読み込んだファイルを外部に送信しません。

公開URL: https://r77tchan.github.io/clickpost-tool/

## 機能

- 4分割スロットをドラッグ&ドロップ(またはクリック)で配置・移動・入れ替え(複数件の一括印刷も、空き面への1件印刷も可能)
- 元のラベルに印字されている切り取り線(破線+ハサミ)を自動で消去
- 「切り取り線を入れる」にチェックすると、A4 を必ず4分割する十字の破線を印字(普通紙に印刷して切る運用向け。初期はOFF)
- 印刷設定の変更は不要(そのまま印刷するだけで原寸で出力されます)

## 2つの使い方

| 形態 | 用途 |
|---|---|
| [GitHub Pages](https://r77tchan.github.io/clickpost-tool/) | URL でアクセス。main へ push すると自動デプロイ |
| シングルHTML | `npm run build:single` で生成される `dist-single/index.html`(1ファイル・約2.4MB)を配布。**Chrome/Edge でダブルクリックするだけで動作**(ネット接続不要) |

## 開発

```bash
npm install       # postinstall で pdfjs のアセットが public/pdfjs にコピーされます
npm run dev       # 開発サーバー
npm run build     # GitHub Pages 用ビルド(dist/)
npm run build:single  # 配布用シングルHTML(dist-single/index.html)
```

技術スタック: Vite + React + TypeScript + Tailwind CSS / pdf-lib(PDF生成)+ pdfjs-dist(暗号化PDFの読み込み・描画)

## 注意事項

- **実際の宛名入りPDFをコミットしないでください**(個人情報)。`*.pdf` は .gitignore 済みです。
- ドキュメント類にも実在の顧客名を書かないでください。
- 設計・実装の詳細: [docs/requirements.md](docs/requirements.md) / [docs/implementation-notes.md](docs/implementation-notes.md)(クリックポストPDFの暗号化、日本語CMap、worker、シングルファイル化などの知見を記録)
