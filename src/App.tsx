import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { SLOT_COUNT, SLOT_NAMES } from './constants.ts'
import { composeSheet } from './pdf.ts'
import { loadLabelFromFile } from './reader.ts'
import type { LoadedLabel } from './reader.ts'
import { downloadPdf, printPdf } from './output.ts'

type Slots = ReadonlyArray<LoadedLabel | null>

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

export default function App() {
  const [slots, setSlots] = useState<Slots>(() => Array.from({ length: SLOT_COUNT }, () => null))
  const [selected, setSelected] = useState<number | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [cutLines, setCutLines] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasAny = slots.some((slot) => slot !== null)

  const addFiles = async (files: ArrayLike<File>) => {
    if (busy) return
    setBusy(true)
    const notes: string[] = []
    const next = [...slots]
    try {
      for (const file of Array.from(files)) {
        if (!next.includes(null)) {
          notes.push('空き面がないため、これ以上読み込めません(最大4件)。')
          break
        }
        const result = await loadLabelFromFile(file)
        if (!result.ok) {
          notes.push(result.error)
          continue
        }
        next[next.indexOf(null)] = result.label
      }
      setSlots(next)
    } finally {
      setMessages(notes)
      setBusy(false)
    }
  }

  // 面クリック: 未選択なら選択、選択中なら移動先として入れ替え
  const handleSlotClick = (index: number) => {
    if (selected === null) {
      if (slots[index]) setSelected(index)
      return
    }
    if (selected === index) {
      setSelected(null)
      return
    }
    const next = [...slots]
    ;[next[selected], next[index]] = [next[index], next[selected]]
    setSlots(next)
    setSelected(null)
  }

  const removeLabel = (index: number) => {
    setSlots(slots.map((slot, i) => (i === index ? null : slot)))
    setSelected(null)
  }

  const generate = async (action: 'download' | 'print') => {
    if (busy || !hasAny) return
    setBusy(true)
    try {
      const bytes = await composeSheet(
        slots.map((slot) => slot?.pngBytes ?? null),
        { cutLines },
      )
      if (action === 'download') {
        downloadPdf(bytes, `clickpost_${formatTimestamp(new Date())}.pdf`)
      } else {
        printPdf(bytes)
      }
    } catch (error) {
      setMessages([
        `PDFの生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      ])
    } finally {
      setBusy(false)
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) void addFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold">📮 クリックポスト面付けツール</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          クリックポストの宛名ラベルPDF(最大4件)を、A4・4面シール用紙(A-one 77220
          など)の好きな面に配置し直したPDFを作ります。元のラベルにある切り取り線は自動で消去されます。
          ファイルはブラウザ内でのみ処理され、外部には送信されません。
        </p>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <div>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
              }`}
            >
              <p className="text-sm text-gray-600">クリックポストのPDFをここにドラッグ&ドロップ</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="mt-3 cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                ファイルを選択
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            {messages.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                {messages.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            )}

            <label className="mt-6 flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={cutLines}
                onChange={(event) => setCutLines(event.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              切り取り線を入れる(4分割の破線)
            </label>

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void generate('download')}
                disabled={!hasAny || busy}
                className="cursor-pointer rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-default disabled:opacity-40"
              >
                PDFをダウンロード
              </button>
              <button
                type="button"
                onClick={() => void generate('print')}
                disabled={!hasAny || busy}
                className="cursor-pointer rounded-md border border-blue-600 bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-default disabled:opacity-40"
              >
                印刷
              </button>
            </div>
            <p className="mt-3 text-xs font-medium text-red-600">
              ⚠ 印刷時は倍率を「実際のサイズ(100%)」にしてください。「用紙に合わせる」ではシール枠からずれます。
            </p>

            <section className="mt-8 rounded-md bg-white p-4 text-sm text-gray-600 shadow-sm">
              <h2 className="font-semibold text-gray-800">使い方</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>クリックポストでダウンロードした宛名ラベルPDFを読み込む(最大4件)</li>
                <li>プレビューの面をクリックして選択し、移動先の面をクリックして配置を決める</li>
                <li>普通紙に印刷して切る場合は「切り取り線を入れる」にチェック</li>
                <li>「PDFをダウンロード」または「印刷」で出力し、倍率100%で印刷する</li>
              </ol>
            </section>
          </div>

          <div>
            <div className="mx-auto aspect-[210/297] w-full max-w-105 overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
              <div className="grid h-full grid-cols-2 grid-rows-2">
                {slots.map((slot, index) => (
                  <div
                    key={slot?.id ?? `empty-${index}`}
                    className={`relative border border-dashed ${
                      cutLines ? 'border-gray-500' : 'border-gray-300'
                    }`}
                  >
                    {slot ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSlotClick(index)}
                          title={`${SLOT_NAMES[index]}: ${slot.fileName}`}
                          className={`block h-full w-full cursor-pointer bg-white ${
                            selected === index ? 'ring-4 ring-blue-500 ring-inset' : ''
                          }`}
                        >
                          <img
                            src={slot.previewUrl}
                            alt={slot.fileName}
                            className="h-full w-full object-fill"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLabel(index)}
                          title="この面から削除"
                          className="absolute top-1 right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-gray-800/70 text-xs text-white transition hover:bg-red-600"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSlotClick(index)}
                        className={`flex h-full w-full cursor-pointer items-center justify-center text-xs transition ${
                          selected !== null
                            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {selected !== null ? `${SLOT_NAMES[index]}へ移動` : `${SLOT_NAMES[index]}(空き)`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">
              面をクリックして選択 → 移動先の面をクリックで移動・入れ替え
              {cutLines && <span className="block">境界の破線どおりに切り取り線が印刷されます</span>}
            </p>
            {hasAny && (
              <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
                {slots.map(
                  (slot, index) =>
                    slot && (
                      <li key={slot.id}>
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 rounded bg-gray-200 px-1 py-0.5 text-center font-medium">
                            {SLOT_NAMES[index]}
                          </span>
                          <span className="truncate" title={slot.fileName}>
                            {slot.fileName}
                          </span>
                        </div>
                        {slot.warnings.map((warning) => (
                          <p key={warning} className="mt-0.5 pl-11 text-amber-600">
                            ⚠ {warning}
                          </p>
                        ))}
                      </li>
                    ),
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
