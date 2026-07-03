// クリックポストの宛名ラベルは A4 の左上ちょうど 1/4(105×148.5mm)に印字される。
// シール用紙(A-one 77220 など)も A4 を余白なしで 4 面(2列×2段)に分割したもので、
// 面付けは「元PDFの左上 1/4 を、出力 A4 の 4 象限のいずれかへ原寸で平行移動する」だけでよい。
export const MM_TO_PT = 72 / 25.4

export const A4_WIDTH_PT = 210 * MM_TO_PT
export const A4_HEIGHT_PT = 297 * MM_TO_PT
export const LABEL_WIDTH_MM = 105
export const LABEL_HEIGHT_MM = 148.5
export const LABEL_WIDTH_PT = A4_WIDTH_PT / 2
export const LABEL_HEIGHT_PT = A4_HEIGHT_PT / 2

// 元PDFのラベル領域の右端・下端の境界線上には切り取り線(破線+ハサミ)が印刷されている。
// この帯を白塗りで消す(ラベル本体の赤枠は境界から5mm以上内側にあるため影響しない)
export const TRIM_RIGHT_MM = 4
export const TRIM_BOTTOM_MM = 4

export const SLOT_COUNT = 4

// ラベル画像のレンダリング解像度。バーコード・QRコードの印刷品質を確保するため 600dpi とする
export const LABEL_RENDER_DPI = 600

// スロット順: 0=左上, 1=右上, 2=左下, 3=右下
export const SLOT_NAMES = ['左上', '右上', '左下', '右下'] as const

// PDF 座標系(左下原点)での各スロットの左下座標
export const SLOT_ORIGINS_PT: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: LABEL_HEIGHT_PT },
  { x: LABEL_WIDTH_PT, y: LABEL_HEIGHT_PT },
  { x: 0, y: 0 },
  { x: LABEL_WIDTH_PT, y: 0 },
]
