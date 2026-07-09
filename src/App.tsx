import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { SLOT_COUNT, SLOT_NAMES } from './constants.ts'
import { composeSheet } from './pdf.ts'
import { loadLabelFromFile } from './reader.ts'
import type { LoadedLabel } from './reader.ts'
import { downloadPdf } from './output.ts'

type Slots = ReadonlyArray<LoadedLabel | null>

// スロット間ドラッグ&ドロップの DataTransfer 型(ファイルのドロップと区別するためのカスタム型)
const SLOT_MIME = 'application/x-clickpost-slot'

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
  const [dragSource, setDragSource] = useState<number | null>(null)
  const [dragTarget, setDragTarget] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasAny = slots.some((slot) => slot !== null)

  // targetIndex を指定すると、最初に読み込めたファイルをその面に配置(既存ラベルは上書き)し、
  // 2件目以降は「落とした面の次」から 左上→右上→左下→右下 の循環順で空き面へ流し込む
  // (例: 右上に2件ドロップ → 2件目は左下、右下にドロップ → 2件目は左上)
  const addFiles = async (files: ArrayLike<File>, targetIndex?: number) => {
    if (busy) return
    setBusy(true)
    const notes: string[] = []
    const next = [...slots]
    const replaced: LoadedLabel[] = []
    let pendingTarget = targetIndex
    const searchStart = targetIndex === undefined ? 0 : targetIndex + 1
    const fillOrder = Array.from({ length: SLOT_COUNT }, (_, i) => (searchStart + i) % SLOT_COUNT)
    try {
      for (const file of Array.from(files)) {
        const dest = pendingTarget ?? fillOrder.find((slot) => next[slot] === null) ?? -1
        if (dest === -1) {
          notes.push('空き面がないため、これ以上読み込めません(最大4件)。')
          break
        }
        const result = await loadLabelFromFile(file)
        if (!result.ok) {
          notes.push(result.error)
          continue
        }
        const previous = next[dest]
        if (previous) replaced.push(previous)
        next[dest] = result.label
        pendingTarget = undefined
      }
      setSlots(next)
      for (const label of replaced) URL.revokeObjectURL(label.printUrl)
    } finally {
      setMessages(notes)
      setBusy(false)
    }
  }

  const swapSlots = (from: number, to: number) => {
    if (from === to) return
    const next = [...slots]
    ;[next[from], next[to]] = [next[to], next[from]]
    setSlots(next)
  }

  // 面クリック: 未選択なら選択、選択中なら移動先として入れ替え
  const handleSlotClick = (index: number) => {
    if (selected === null) {
      if (slots[index]) setSelected(index)
      return
    }
    if (selected !== index) swapSlots(selected, index)
    setSelected(null)
  }

  const removeLabel = (index: number) => {
    const target = slots[index]
    if (target) URL.revokeObjectURL(target.printUrl)
    setSlots(slots.map((slot, i) => (i === index ? null : slot)))
    setSelected(null)
  }

  const downloadSheet = async () => {
    if (busy || !hasAny) return
    setBusy(true)
    try {
      const bytes = await composeSheet(
        slots.map((slot) => slot?.pngBytes ?? null),
        { cutLines },
      )
      downloadPdf(bytes, `clickpost_${formatTimestamp(new Date())}.pdf`)
    } catch (error) {
      setMessages([
        `PDFの生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      ])
    } finally {
      setBusy(false)
    }
  }

  // 印刷は PDF を経由せず、印刷専用レイアウト(.print-sheet)をブラウザに出力させる。
  // file:// で開いたシングルHTML版でも動く(iframe + blob PDF 方式は動かない)
  const printSheet = () => {
    if (busy || !hasAny) return
    window.print()
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
    <>
      <div className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 print:hidden">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold">📮 クリックポスト面付けツール</h1>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
            <div>
              <div
                onDragOver={(event) => {
                  // OSからのファイルドラッグのみ受け付ける(面のドラッグには反応させない)
                  if (!event.dataTransfer.types.includes('Files')) return
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed px-8 py-18 text-center transition select-none ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                }`}
              >
                <p className="text-sm text-gray-600">
                  クリックポストのPDFをここにドラッグ&ドロップ
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="mt-3 cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-blue-700 disabled:cursor-default disabled:opacity-50"
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

              <label className="my-8 flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={cutLines}
                  onChange={(event) => setCutLines(event.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                切り取り線を入れる
              </label>

              <div className="mt-3 flex flex-wrap gap-3 select-none">
                <button
                  type="button"
                  onClick={() => void downloadSheet()}
                  disabled={!hasAny || busy}
                  className="cursor-pointer rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-blue-700 disabled:cursor-default disabled:opacity-40"
                >
                  PDFをダウンロード
                </button>
                <button
                  type="button"
                  onClick={printSheet}
                  disabled={!hasAny || busy}
                  className="cursor-pointer rounded-md border border-blue-600 bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 transition enabled:hover:bg-blue-50 disabled:cursor-default disabled:opacity-40"
                >
                  印刷
                </button>
              </div>
            </div>

            <div>
              <div className="relative mx-auto aspect-[210/297] w-full max-w-105 overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm select-none">
                <div className="grid h-full grid-cols-2 grid-rows-2">
                  {slots.map((slot, index) => (
                    <div
                      key={slot?.id ?? `empty-${index}`}
                      onDragOver={(event) => {
                        const isSlotDrag = event.dataTransfer.types.includes(SLOT_MIME)
                        const isFileDrag = event.dataTransfer.types.includes('Files')
                        if (!isSlotDrag && !isFileDrag) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = isSlotDrag ? 'move' : 'copy'
                        if (dragTarget !== index) setDragTarget(index)
                      }}
                      onDragLeave={() =>
                        setDragTarget((current) => (current === index ? null : current))
                      }
                      onDrop={(event) => {
                        if (event.dataTransfer.types.includes(SLOT_MIME)) {
                          event.preventDefault()
                          const from = Number(event.dataTransfer.getData(SLOT_MIME))
                          if (Number.isInteger(from) && from >= 0 && from < SLOT_COUNT) {
                            swapSlots(from, index)
                          }
                        } else if (event.dataTransfer.files.length) {
                          event.preventDefault()
                          void addFiles(event.dataTransfer.files, index)
                        }
                        setDragSource(null)
                        setDragTarget(null)
                      }}
                      className={`relative border border-dashed border-gray-300 ${
                        dragTarget === index ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
                      }`}
                    >
                      {slot ? (
                        <>
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData(SLOT_MIME, String(index))
                              event.dataTransfer.effectAllowed = 'move'
                              setDragSource(index)
                              setSelected(null)
                            }}
                            onDragEnd={() => {
                              setDragSource(null)
                              setDragTarget(null)
                            }}
                            onClick={() => handleSlotClick(index)}
                            title={`${SLOT_NAMES[index]}: ${slot.fileName}`}
                            className={`block h-full w-full cursor-grab bg-white active:cursor-grabbing ${
                              selected === index ? 'ring-4 ring-blue-500 ring-inset' : ''
                            } ${dragSource === index ? 'opacity-40' : ''}`}
                          >
                            <img
                              src={slot.previewUrl}
                              alt={slot.fileName}
                              draggable={false}
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
                          {selected !== null
                            ? `${SLOT_NAMES[index]}へ移動`
                            : `${SLOT_NAMES[index]}(空き)`}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* 切り取り線プレビュー: 実際の出力と同じく中央の十字のみ(外周には線は印刷されない) */}
                {cutLines && (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-gray-600" />
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-gray-600" />
                  </>
                )}
              </div>
              {cutLines && (
                <p className="mt-2 text-center text-xs text-gray-400">
                  十字の破線どおりに切り取り線が印刷されます
                </p>
              )}
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

      {/* 印刷専用レイアウト(画面では非表示、window.print() 時のみ A4 原寸で出力される) */}
      <div className="print-sheet" aria-hidden="true">
        {slots.map(
          (slot, index) =>
            slot && (
              <img
                key={slot.id}
                src={slot.printUrl}
                alt=""
                className={`print-label print-label-${index}`}
              />
            ),
        )}
        {cutLines && (
          <>
            <div className="print-cut-v" />
            <div className="print-cut-h" />
          </>
        )}
      </div>
    </>
  )
}
