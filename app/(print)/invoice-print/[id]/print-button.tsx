'use client'
import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-900 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  )
}