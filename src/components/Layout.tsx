import { Link, Outlet } from 'react-router'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight transition hover:opacity-70">
            🧰 skym-tools
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
