import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 2つのビルドモード:
// - 通常ビルド(`npm run build`): GitHub Pages 用。pdfjs のアセットは public/pdfjs から配信
// - シングルHTML(`npm run build:single`): 配布用。全アセットを1つの index.html に埋め込み、
//   file:// でダブルクリックで開いても動作する
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: single ? './' : '/clickpost-tool/',
    define: {
      __SINGLE_FILE__: JSON.stringify(single),
    },
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    build: single
      ? {
          outDir: 'dist-single',
          // .bcmap 等を data URL としてインライン化する
          assetsInlineLimit: 100_000_000,
          // public/pdfjs はバンドルに埋め込むためコピー不要
          copyPublicDir: false,
        }
      : {},
  }
})
