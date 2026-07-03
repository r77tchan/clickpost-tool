import { PDFDocument, rgb } from 'pdf-lib'
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  LABEL_HEIGHT_PT,
  LABEL_WIDTH_PT,
  MM_TO_PT,
  SLOT_ORIGINS_PT,
} from './constants.ts'

export interface ComposeOptions {
  /** A4 を必ず 4 分割する十字の切り取り線(破線)を描画する */
  cutLines: boolean
}

// 各スロットのラベル画像(null = 空き)から、面付け済みの A4 1枚の PDF を生成する。
// クリックポストの PDF は暗号化されていて pdf-lib ではページのベクター埋め込みができないため、
// pdfjs で高解像度レンダリングした PNG(reader.ts)を原寸(105×148.5mm)で貼り付ける。
export async function composeSheet(
  slotPngs: ReadonlyArray<Uint8Array | null>,
  options: ComposeOptions,
): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const page = out.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])

  for (const [slot, png] of slotPngs.entries()) {
    if (!png) continue
    const image = await out.embedPng(png)
    const origin = SLOT_ORIGINS_PT[slot]
    page.drawImage(image, {
      x: origin.x,
      y: origin.y,
      width: LABEL_WIDTH_PT,
      height: LABEL_HEIGHT_PT,
    })
  }

  if (options.cutLines) {
    const color = rgb(0.62, 0.62, 0.62)
    const dashArray = [2 * MM_TO_PT, 2 * MM_TO_PT] // 2mm 線 + 2mm 間隔
    const thickness = 0.5
    // 縦横とも A4 の端から端まで引き、必ず 4 分割になるようにする
    page.drawLine({
      start: { x: LABEL_WIDTH_PT, y: 0 },
      end: { x: LABEL_WIDTH_PT, y: A4_HEIGHT_PT },
      thickness,
      color,
      dashArray,
    })
    page.drawLine({
      start: { x: 0, y: LABEL_HEIGHT_PT },
      end: { x: A4_WIDTH_PT, y: LABEL_HEIGHT_PT },
      thickness,
      color,
      dashArray,
    })
  }

  return out.save()
}
