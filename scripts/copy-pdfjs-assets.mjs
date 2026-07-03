// pdfjs が日本語テキスト(CIDフォント)等を描画するのに必要な同梱リソースを
// node_modules から public/ へコピーする(postinstall で自動実行)。
// public/pdfjs はコミットしない(.gitignore 済み)。
import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(projectRoot, 'node_modules', 'pdfjs-dist')
const dest = join(projectRoot, 'public', 'pdfjs')

await mkdir(dest, { recursive: true })
await cp(join(src, 'cmaps'), join(dest, 'cmaps'), { recursive: true })
await cp(join(src, 'standard_fonts'), join(dest, 'standard_fonts'), { recursive: true })
// 画像デコーダ(JBIG2/JPEG2000)とカラー変換(qcms)の wasm、ICC プロファイル
await cp(join(src, 'wasm'), join(dest, 'wasm'), { recursive: true })
await cp(join(src, 'iccs'), join(dest, 'iccs'), { recursive: true })
// worker はバンドルせず静的配信する(Vite dev の巨大 module worker 変換ハング回避と、
// ビルドチャンク肥大の回避のため)
await cp(join(src, 'build', 'pdf.worker.min.mjs'), join(dest, 'pdf.worker.min.mjs'))
console.log('copied pdfjs assets -> public/pdfjs')
