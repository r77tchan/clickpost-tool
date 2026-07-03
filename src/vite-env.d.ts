/// <reference types="vite/client" />

// vite.config.ts の define で注入されるビルドフラグ。
// true = 配布用シングルHTML版(全アセットをバンドルに埋め込み、fetch を使わない)
declare const __SINGLE_FILE__: boolean

declare module '*?url' {
  const src: string
  export default src
}

declare module '*?raw' {
  const src: string
  export default src
}
