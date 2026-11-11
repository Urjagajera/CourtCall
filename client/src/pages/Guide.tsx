import { ArrowLeft } from 'lucide-react'
import { marked } from 'marked'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
// The repo's GUIDE.md is the single source: this page and GitHub always show the same text.
import guide from '../../../GUIDE.md?raw'
import { InstallApp } from '../components/InstallApp'
import { Logo } from '../components/Logo'

/** Public help page at /guide: how to install CourtCall and use it, for every role. */
export default function Guide() {
  // Trusted content from our own repo (not user input), so rendering it as HTML is safe.
  const html = useMemo(() => marked.parse(guide, { async: false, gfm: true }), [])
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[900px] items-center justify-between gap-3 px-4">
          <Logo />
          <Link to="/" className="flex items-center gap-1 text-label font-semibold hover:underline">
            <ArrowLeft className="size-4" strokeWidth={1.75} /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-6">
        <InstallApp />
        <article className="cc-guide" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  )
}
