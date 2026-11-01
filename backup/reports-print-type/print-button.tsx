'use client'
import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  )
}