# 🧰 skym-tools

自社業務用の小さなツールを集めた Web アプリ。すべて**ブラウザ内で完結**し、読み込んだファイルを外部に送信しません。

公開URL: https://r77tchan.github.io/skym-tools/

## ツール一覧

### 📮 クリックポスト面付けツール

クリックポスト(日本郵便)の宛名ラベルPDFは A4 の左上固定で印字されるため、普通紙では毎回はさみで切り取る必要がありました。このツールは、宛名ラベルPDF(最大4件)を読み込み、**A4・4面のシール用紙([A-one 77220](https://www.a-one.co.jp/product/search/detail.php?id=77220) など、105×148.5mm × 4面)の好きな面に配置し直した PDF** を作ります。

- 4分割スロットをクリックして配置・移動・入れ替え
- 複数件を1枚にまとめて一括印刷も、1件だけを空いている面に印刷することも可能
- **印刷時は倍率「実際のサイズ(100%)」を指定してください**(「用紙に合わせる」ではシール枠からずれます)

## 開発

```bash
npm install   # postinstall で pdfjs のアセットが public/pdfjs にコピーされます
npm run dev   # 開発サーバー
npm run build # 型チェック + 本番ビルド(dist/)
```

技術スタック: Vite + React + TypeScript + Tailwind CSS + React Router(HashRouter)/ pdf-lib + pdfjs-dist

main ブランチへ push すると GitHub Actions が自動で GitHub Pages にデプロイします。

## ツールの追加方法

1. `src/tools/<slug>/index.tsx` にツール画面のコンポーネントを作る
2. `src/tools/registry.ts` にメタ情報(slug・名前・説明・アイコン・lazy import)を1件追加する

これだけでホーム画面のカード一覧とルーティング(`/#/tools/<slug>`)に自動反映されます。

## 注意事項

- **実際の宛名入りPDFをコミットしないでください**(個人情報)。`*.pdf` は .gitignore 済みです。
- ドキュメント類にも実在の顧客名を書かないでください。
- 設計・実装の詳細: [docs/requirements.md](docs/requirements.md) / [docs/implementation-notes.md](docs/implementation-notes.md)
