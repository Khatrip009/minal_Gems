'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { amountInWords } from '@/lib/number-to-words'

type InvoiceForPdf = {
  id: string
  invoice_number: string
  invoice_date: string | null
  place_of_supply: string | null
  subtotal: number | string
  tax_amount: number | string
  discount: number | string | null
  total: number | string
  customers: {
    name: string
    phone: string | null
    gstin: string | null
    address: string | null
    city: string | null
    state: string | null
    pincode: string | null
  } | null
  items: Array<{
    item_description: string
    inventory_item_id: string | null
    inventory_tag: string | null
    metal_purity_code: string | null
    net_metal_weight_g: number | string
    stone_details: any
    subtotal: number | string
    // ★ added so the PDF can include product photos
    image_url?: string | null
  }>
}

type Props = {
  invoice: InvoiceForPdf
}

// Convert an image URL to a data URL so jsPDF can embed it without CORS issues
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function InvoicePdfButton({ invoice }: Props) {
  const [loading, setLoading] = useState(false)

  async function downloadPdf() {
    setLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = 210
      const pageHeight = 297
      const margin = 14
      const contentWidth = pageWidth - margin * 2

      // Company header
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Minal Gems', margin, 18)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80)
      doc.text(
        '33, Sant tukaram Society- 2, Nr. Ramji Temple, Palanpur Jakatnaka, Surat, Gujarat',
        margin,
        23,
      )
      doc.text('+91 7096785900  ·  GSTIN 24XXXXX1234X1Z5  ·  PAN XXXXX1234', margin, 27)
      doc.setTextColor(0)

      // Invoice title
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('TAX INVOICE', pageWidth - margin, 18, { align: 'right' })
      doc.setFontSize(10)
      doc.setTextColor(180, 100, 0)
      doc.text(invoice.invoice_number, pageWidth - margin, 24, { align: 'right' })
      doc.setFontSize(8)
      doc.setTextColor(80)
      doc.text(
        invoice.invoice_date
          ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
              dateStyle: 'medium',
            })
          : '—',
        pageWidth - margin,
        29,
        { align: 'right' },
      )
      doc.setTextColor(0)
      doc.setLineWidth(0.5)
      doc.line(margin, 33, pageWidth - margin, 33)

      // Billed to
      let y = 40
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text('BILLED TO', margin, y)
      doc.setTextColor(0)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(invoice.customers?.name ?? 'Walk-in customer', margin, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(80)
      if (invoice.customers?.phone) {
        doc.text(invoice.customers.phone, margin, y + 9)
      }

      // Place of supply
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text('PLACE OF SUPPLY', pageWidth - margin, y, { align: 'right' })
      doc.setFontSize(10)
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text(invoice.place_of_supply ?? '—', pageWidth - margin, y + 5, {
        align: 'right',
      })

      // Items
      y += 16
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(80)
      doc.text('ITEM', margin, y)
      doc.text('WEIGHT', margin + 100, y)
      doc.text('AMOUNT', pageWidth - margin, y, { align: 'right' })
      doc.setTextColor(0)
      doc.setFont('helvetica', 'normal')
      y += 3
      doc.line(margin, y, pageWidth - margin, y)

      for (const it of invoice.items) {
        y += 6
        if (y > pageHeight - 40) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(String(it.item_description ?? 'Item').slice(0, 60), margin, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        if (it.metal_purity_code || it.net_metal_weight_g) {
          const sub = [
            it.metal_purity_code,
            Number(it.net_metal_weight_g) > 0
              ? `${Number(it.net_metal_weight_g).toFixed(3)} g`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
          doc.setTextColor(100)
          doc.text(sub, margin, y + 4)
          doc.setTextColor(0)
        }
        doc.setFont('helvetica', 'bold')
        doc.text(
          `Rs. ${Number(it.subtotal).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
          })}`,
          pageWidth - margin,
          y,
          { align: 'right' },
        )
      }

      // Totals
      y += 8
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      const totalRows: Array<[string, string]> = [
        ['Subtotal', `Rs. ${Number(invoice.subtotal).toFixed(2)}`],
        ['Tax', `Rs. ${Number(invoice.tax_amount).toFixed(2)}`],
      ]
      if (Number(invoice.discount) > 0) {
        totalRows.push([
          'Discount',
          `- Rs. ${Number(invoice.discount).toFixed(2)}`,
        ])
      }
      totalRows.push(['Invoice Total', `Rs. ${Number(invoice.total).toFixed(2)}`])

      for (const [label, value] of totalRows) {
        doc.setFontSize(9)
        if (label === 'Invoice Total') {
          doc.setFont('helvetica', 'bold')
        } else {
          doc.setFont('helvetica', 'normal')
        }
        doc.text(label, pageWidth - margin - 40, y, { align: 'right' })
        doc.text(value, pageWidth - margin, y, { align: 'right' })
        y += 5
      }

      // Amount in words
      y += 2
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(80)
      doc.text(amountInWords(Number(invoice.total)), margin, y)
      doc.setTextColor(0)

      // Footer
      y = pageHeight - 15
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(
        'This is a computer-generated invoice. No physical signature required.',
        pageWidth / 2,
        y,
        { align: 'center' },
      )

      doc.save(`invoice-${invoice.invoice_number}.pdf`)
    } catch (err) {
      console.error('[InvoicePdfButton] PDF generation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? 'Generating…' : 'Download PDF'}
    </button>
  )
}