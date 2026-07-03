import { PDFDocument } from 'pdf-lib'
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  LABEL_HEIGHT_PT,
  LABEL_WIDTH_PT,
  SLOT_ORIGINS_PT,
} from './constants.ts'

// 各スロットのラベル画像(null = 空き)から、面付け済みの A4 1枚の PDF を生成する。
// クリックポストの PDF は暗号化されていて pdf-lib ではページのベクター埋め込みができないため、
// pdfjs で高解像度レンダリングした PNG(reader.ts)を原寸(105×148.5mm)で貼り付ける。
export async function composeSheet(
  slotPngs: ReadonlyArray<Uint8Array | null>,
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

  return out.save()
}
