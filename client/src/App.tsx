import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

function Home() {
  const [api, setApi] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setApi(r.ok ? 'ok' : 'down'))
      .catch(() => setApi('down'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-bold text-brand-900">CourtCall</h1>
        <p className="mt-2 text-slate-600">
          Connecting courtroom progress with the people who need to know.
        </p>
      </div>
      <p className="text-sm text-slate-500">
        API:{' '}
        <span
          className={
            api === 'ok' ? 'text-green-600' : api === 'down' ? 'text-red-600' : 'text-slate-400'
          }
        >
          {api}
        </span>
      </p>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
