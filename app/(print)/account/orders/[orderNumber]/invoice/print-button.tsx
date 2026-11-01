'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 text-xs font-semibold print:hidden"
    >
      <Printer className="h-3.5 w-3.5" /> Print / Save PDF
    </button>
  )
}