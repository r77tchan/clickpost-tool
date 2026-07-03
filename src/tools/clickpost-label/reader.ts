import * as pdfjs from 'pdfjs-dist'
import { LABEL_RENDER_DPI, MM_TO_PT } from './constants.ts'

// worker・CMap(日本語CIDフォントの描画に必要)・標準フォントは、postinstall
// (scripts/copy-pdfjs-assets.mjs)で node_modules から public/pdfjs へコピーして静的配信する。
// worker は Blob URL で起動するため、worker 内の fetch でも解決できるよう絶対 URL にする
const PDFJS_ASSETS = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href

// worker スクリプトは fetch して Blob URL で起動する。ブラウザ拡張などが Worker の
// スクリプトリクエストをインターセプトして固まる環境があるため(fetch は影響を受けない)
let workerSrcPromise: Promise<string> | null = null

function ensureWorkerSrc(): Promise<string> {
  workerSrcPromise ??= (async () => {
    try {
      const response = await fetch(`${PDFJS_ASSETS}pdf.worker.min.mjs`)
      if (!response.ok) {
        throw new Error(`worker の取得に失敗しました(HTTP ${response.status})`)
      }
      const blob = await response.blob()
      return URL.createObjectURL(blob.slice(0, blob.size, 'text/javascript'))
    } catch (error) {
      workerSrcPromise = null
      throw error
    }
  })()
  return workerSrcPromise
}

export interface LoadedLabel {
  id: string
  fileName: string
  /** ラベル領域(ページ左上 1/4)を印刷品質でレンダリングした PNG(出力 PDF に埋め込む) */
  pngBytes: Uint8Array
  /** 画面プレビュー用の縮小画像(data URL) */
  previewUrl: string
  warnings: string[]
}

export type LoadResult = { ok: true; label: LoadedLabel } | { ok: false; error: string }

const PREVIEW_WIDTH_PX = 420

// クリックポストの PDF は RC4 暗号化されており pdf-lib ではページを埋め込めないため、
// 復号に対応した pdfjs でラベル領域を高解像度レンダリングして画像として扱う。
export async function loadLabelFromFile(file: File): Promise<LoadResult> {
  pdfjs.GlobalWorkerOptions.workerSrc = await ensureWorkerSrc()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    cMapUrl: `${PDFJS_ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSETS}standard_fonts/`,
    wasmUrl: `${PDFJS_ASSETS}wasm/`,
    iccUrl: `${PDFJS_ASSETS}iccs/`,
  })

  let doc: Awaited<typeof loadingTask.promise>
  try {
    doc = await loadingTask.promise
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      return { ok: false, error: `「${file.name}」はパスワード付きPDFのため読み込めません。` }
    }
    return { ok: false, error: `「${file.name}」はPDFとして読み込めませんでした。` }
  }

  try {
    const warnings: string[] = []
    if (doc.numPages > 1) {
      warnings.push('複数ページのPDFのため、1ページ目のみ使用します。')
    }

    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 }) // pt 単位
    const widthMm = base.width / MM_TO_PT
    const heightMm = base.height / MM_TO_PT
    if (Math.abs(widthMm - 210) > 5 || Math.abs(heightMm - 297) > 5) {
      warnings.push(
        `A4サイズではありません(約${Math.round(widthMm)}×${Math.round(heightMm)}mm)。配置がずれる可能性があります。`,
      )
    }

    // ページ全体の viewport に対して canvas を半分の大きさにすることで、左上 1/4 だけを切り出す
    const scale = LABEL_RENDER_DPI / 72
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width / 2)
    canvas.height = Math.round(viewport.height / 2)
    const renderTask = page.render({ canvas, viewport, intent: 'print' })
    // 描画継続を requestAnimationFrame に任せない(バックグラウンドタブでは rAF が
    // 停止し、レンダリングが永遠に完了しなくなるため)
    renderTask.onContinue = (cont: () => void) => cont()
    await renderTask.promise

    const pngBytes = await canvasToPngBytes(canvas)
    const previewUrl = shrinkToDataUrl(canvas, PREVIEW_WIDTH_PX)

    return {
      ok: true,
      label: { id: crypto.randomUUID(), fileName: file.name, pngBytes, previewUrl, warnings },
    }
  } catch {
    return { ok: false, error: `「${file.name}」の描画に失敗しました。` }
  } finally {
    void loadingTask.destroy()
  }
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('PNGへの変換に失敗しました'))),
      'image/png',
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

function shrinkToDataUrl(source: HTMLCanvasElement, targetWidth: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = Math.round((source.height / source.width) * targetWidth)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas 2d context を取得できませんでした')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
