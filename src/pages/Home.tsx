import { Link } from 'react-router'
import { tools } from '../tools/registry.ts'

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold">ツール一覧</h1>
      <p className="mt-1 text-sm text-gray-500">日々の業務で使う小さなツールを集めたサイトです。</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            to={`/tools/${tool.slug}`}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md"
          >
            <div className="text-3xl">{tool.icon}</div>
            <h2 className="mt-2 font-semibold">{tool.name}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
