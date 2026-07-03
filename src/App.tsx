import { Suspense } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import Layout from './components/Layout.tsx'
import Home from './pages/Home.tsx'
import { tools } from './tools/registry.ts'

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      ...tools.map((tool) => ({
        path: `tools/${tool.slug}`,
        element: (
          <Suspense fallback={<p className="py-16 text-center text-gray-500">読み込み中…</p>}>
            <tool.component />
          </Suspense>
        ),
      })),
      {
        path: '*',
        element: <p className="py-16 text-center text-gray-500">ページが見つかりません。</p>,
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
