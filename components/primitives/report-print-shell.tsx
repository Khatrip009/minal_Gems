import Link from 'next/link'
import Image from 'next/image'
import { ReportPrintButton } from './report-print-button'
import { getCompanySettings, formatAddress } from '@/lib/company-settings'
import { createClient } from '@/lib/supabase/server'

export async function ReportPrintShell({
  title,
  subtitle,
  filename,
  backHref,
  printedBy,
  footerInfo,
  children,
}: {
  title: string
  subtitle?: string
  filename: string
  backHref: string
  printedBy?: string | null
  footerInfo?: React.ReactNode
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const settings = await getCompanySettings(supabase)
  const address = formatAddress(settings)

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { margin: 0; padding: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `,
        }}
      />
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 print:hidden">
        <Link href={backHref} className="text-sm text-slate-600 hover:underline">
          ← Back
        </Link>
        <ReportPrintButton filename={filename} />
      </div>
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-8 text-sm text-slate-900 shadow-lg print:my-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <Image
              src={settings.logo_url || '/logo_minalgems.png'}
              alt={settings.name}
              width={150}
              height={150}
              className="rounded"
              priority
            />
            <div>
              <p className="text-lg font-bold leading-tight">{settings.name}</p>
              <p className="text-xs text-slate-600">Jewellery Manufacturing</p>
              {address && (
                <p className="text-[10px] text-slate-500">{address}</p>
              )}
              {settings.phone && (
                <p className="text-[10px] text-slate-500">{settings.phone}</p>
              )}
              {settings.gstin && (
                <p className="text-[10px] text-slate-500">
                  GSTIN: {settings.gstin}
                  {settings.pan && <> · PAN: {settings.pan}</>}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wider">{title}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-600">{subtitle}</p>}
          </div>
        </div>
        <div className="py-4">{children}</div>
        <div className="mt-4 flex justify-between border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          <span>
            Printed{' '}
            {new Date().toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {printedBy && <> by {printedBy}</>}
            {settings.report_terms && <> · {settings.report_terms}</>}
          </span>
          {footerInfo && <span>{footerInfo}</span>}
        </div>
      </div>
    </div>
  )
}