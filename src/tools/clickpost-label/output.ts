// 生成した PDF のダウンロードと印刷(すべてブラウザ内で完結し、外部送信しない)

function toBlobUrl(bytes: Uint8Array): string {
  // pdf-lib の返す Uint8Array は ArrayBufferLike ベースの型のため、コピーして ArrayBuffer に揃える
  const copy = new Uint8Array(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
}

export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const url = toBlobUrl(bytes)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

// 非表示 iframe に PDF を読み込み、ブラウザの印刷ダイアログを開く
export function printPdf(bytes: Uint8Array): void {
  const url = toBlobUrl(bytes)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.src = url

  const cleanup = () => {
    URL.revokeObjectURL(url)
    iframe.remove()
  }
  iframe.addEventListener('load', () => {
    const win = iframe.contentWindow
    if (!win) return
    win.addEventListener('afterprint', () => setTimeout(cleanup, 1_000))
    win.focus()
    win.print()
  })
  // afterprint が発火しないブラウザ向けの保険
  setTimeout(cleanup, 10 * 60_000)

  document.body.appendChild(iframe)
}
