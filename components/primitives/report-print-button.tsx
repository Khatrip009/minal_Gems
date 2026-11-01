'use client'

import { Printer } from 'lucide-react'

export function ReportPrintButton({ filename }: { filename: string }) {
  function handlePrint() {
    const original = document.title
    document.title = filename
    window.print()
    window.addEventListener('afterprint', () => { document.title = original }, { once: true })
    setTimeout(() => { if (document.title === filename) document.title = original }, 2000)
  }
  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  )
}