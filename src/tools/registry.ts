import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

export interface ToolDef {
  slug: string
  name: string
  description: string
  icon: string
  component: LazyExoticComponent<ComponentType>
}

// ツールを追加するときはここに1件足すだけ(ホームのカード一覧とルーティングに自動反映される)
export const tools: ToolDef[] = [
  {
    slug: 'clickpost-label',
    name: 'クリックポスト面付けツール',
    description:
      'クリックポストの宛名ラベルPDFを読み込み、A4・4面のシール用紙(A-one 77220など)の好きな面に配置し直したPDFを作ります。',
    icon: '📮',
    component: lazy(() => import('./clickpost-label/index.tsx')),
  },
]
