// 生成した PDF のダウンロード(すべてブラウザ内で完結し、外部送信しない)。
// 印刷は PDF を経由せず、App.tsx の印刷専用レイアウト + window.print() で行う
// (blob PDF を iframe で print() する方式は、file:// で開いたシングルHTML版で
//  クロスオリジン制約により動作しないため)。

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
