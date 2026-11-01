'use client'

import { Printer } from 'lucide-react'

export function PrintButton({ filename }: { filename?: string } = {}) {
  function handlePrint() {
    const original = document.title
    if (filename) {
      // Browsers use <title> as the default "Save as PDF" filename
      document.title = filename
    }
    window.print()
    // Restore after the print dialog closes
    window.addEventListener(
      'afterprint',
      () => {
        document.title = original
      },
      { once: true },
    )
    // Fallback for browsers that don't fire afterprint reliably (older Safari)
    setTimeout(() => {
      if (document.title === filename) {
        document.title = original
      }
    }, 2000)
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print / Save as PDF
    </button>
  )
}