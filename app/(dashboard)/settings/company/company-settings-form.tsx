'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/primitives/page-header'
import type { CompanySettings } from '@/lib/company-settings'
import {
  Building2,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Landmark,
  MapPin,
  Percent,
  Phone,
  Save,
  Upload,
  X,
  Loader2,
} from 'lucide-react'

type Form = {
  logo_url: string
  name: string
  company_registration: string
  gstin: string
  pan: string
  state_code: string
  state_name: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  website: string
  bank_name: string
  bank_account: string
  bank_ifsc: string
  bank_branch: string
  invoice_prefix: string
  default_hsn: string
  invoice_terms: string
  report_terms: string
  default_gst_rate: string
  financial_year_start_month: string
  accounting_enabled: boolean
}

const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28]
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const BUCKET = 'company-assets'
const MAX_SIZE_MB = 2

/** Extract the storage path from a public URL. */
function extractStoragePath(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length))
}

function uniqueLogoName(originalName: string): string {
  const ext = (originalName.split('.').pop() || 'png').toLowerCase()
  const base =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `logo-${base}.${ext}`
}

export function CompanySettingsForm({ initial }: { initial: CompanySettings }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<Form>({
    logo_url: initial.logo_url ?? '',
    name: initial.name ?? '',
    company_registration: initial.company_registration ?? '',
    gstin: initial.gstin ?? '',
    pan: initial.pan ?? '',
    state_code: initial.state_code ?? '',
    state_name: initial.state_name ?? '',
    address: initial.address ?? '',
    city: initial.city ?? '',
    state: initial.state ?? '',
    pincode: initial.pincode ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    website: initial.website ?? '',
    bank_name: initial.bank_name ?? '',
    bank_account: initial.bank_account ?? '',
    bank_ifsc: initial.bank_ifsc ?? '',
    bank_branch: initial.bank_branch ?? '',
    invoice_prefix: initial.invoice_prefix ?? 'INV',
    default_hsn: initial.default_hsn ?? '7113',
    invoice_terms: initial.invoice_terms ?? '',
    report_terms: initial.report_terms ?? '',
    default_gst_rate: String(initial.default_gst_rate ?? 3),
    financial_year_start_month: String(initial.financial_year_start_month ?? 4),
    accounting_enabled: initial.accounting_enabled ?? true,
  })

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // ── Logo upload ────────────────────────────────────────────
  async function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, WebP, SVG)')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Logo too large — max ${MAX_SIZE_MB} MB`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const name = uniqueLogoName(file.name)

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(name, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(name)
      setForm((f) => ({ ...f, logo_url: pub.publicUrl }))
      toast.success('Logo uploaded — click Save to keep it')
    } catch (err: any) {
      console.error('[company] logo upload failed:', err)
      toast.error(err?.message ?? 'Upload failed', { duration: 10000 })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function clearLogo() {
    setForm((f) => ({ ...f, logo_url: '' }))
  }

  // ── Save ───────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Company name is required')
    if (form.gstin && form.gstin.length !== 15) {
      return toast.error('GSTIN must be 15 characters')
    }
    if (form.pan && form.pan.length !== 10) {
      return toast.error('PAN must be 10 characters')
    }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      logo_url: form.logo_url.trim() || null,
      name: form.name.trim(),
      company_registration: form.company_registration.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      pan: form.pan.trim().toUpperCase() || null,
      state_code: form.state_code.trim() || '24',
      state_name: form.state_name.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      bank_name: form.bank_name.trim() || null,
      bank_account: form.bank_account.trim() || null,
      bank_ifsc: form.bank_ifsc.trim().toUpperCase() || null,
      bank_branch: form.bank_branch.trim() || null,
      invoice_prefix: form.invoice_prefix.trim() || 'INV',
      default_hsn: form.default_hsn.trim() || '7113',
      invoice_terms: form.invoice_terms.trim() || null,
      report_terms: form.report_terms.trim() || null,
      default_gst_rate: Number(form.default_gst_rate) || 3,
      financial_year_start_month: Number(form.financial_year_start_month) || 4,
      accounting_enabled: form.accounting_enabled,
      updated_at: new Date().toISOString(),
    }

    let error: any = null
    if (initial.id === 'default') {
      ;({ error } = await supabase.from('company_settings').insert(payload))
    } else {
      ;({ error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', initial.id))
    }

    setSaving(false)
    if (error) {
      // If the DB save fails and we uploaded a new logo in this session,
      // clean it up so we don't leave an orphan
      const newPath = extractStoragePath(payload.logo_url)
      const oldPath = extractStoragePath(initial.logo_url)
      if (newPath && newPath !== oldPath) {
        await supabase.storage.from(BUCKET).remove([newPath])
      }
      return toast.error(error.message, { duration: 10000 })
    }

    // Success — if the old logo was in our bucket and changed, delete it
    const oldPath = extractStoragePath(initial.logo_url)
    const newPath = extractStoragePath(payload.logo_url)
    if (oldPath && oldPath !== newPath) {
      await supabase.storage.from(BUCKET).remove([oldPath])
    }

    toast.success('Company settings saved')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-24">
      <PageHeader
        title="Company Profile"
        description="Legal identity, tax identifiers, contact details, and defaults used across invoices and reports."
        actions={
          <div className="flex gap-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              ← All settings
            </Link>
            <Button type="submit" disabled={saving || uploading} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      {/* ── Logo ─────────────────────────────────────── */}
      <Section
        title="Company logo"
        icon={ImageIcon}
        description="Shown on invoice headers, job cards, and every printed report."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="shrink-0">
            {form.logo_url ? (
              <div className="relative">
                <div className="flex h-28 w-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.logo_url}
                    alt="Company logo"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.opacity = '0.3'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={clearLogo}
                  className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white shadow-sm transition-colors hover:bg-rose-700"
                  aria-label="Remove logo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex h-28 w-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
                <ImageIcon className="h-8 w-8 text-slate-300" />
                <p className="mt-1 text-[10px] text-slate-500">No logo yet</p>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[240px] space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleLogoFile(f)
              }}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {form.logo_url ? 'Replace logo' : 'Upload logo'}
                </>
              )}
            </Button>
            <p className="text-[11px] text-slate-500">
              JPG, PNG, WebP, or SVG · max {MAX_SIZE_MB} MB · suggested aspect
              ratio 3:1 or 4:1 for best results on invoice headers.
            </p>
            <p className="text-[11px] text-slate-500">
              Leave blank to fall back to the default{' '}
              <code className="rounded bg-slate-100 px-1">/logo_minalgems.png</code>
            </p>
          </div>
        </div>
      </Section>

      {/* ── Business identity ─────────────────────────── */}
      <Section
        title="Business identity"
        icon={Building2}
        description="Legal name and registration details."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company name" required>
            <Input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Minal Gems"
            />
          </Field>
          <Field label="Company registration no." hint="Optional — CIN, LLPIN, etc.">
            <Input
              value={form.company_registration}
              onChange={(e) => set('company_registration', e.target.value)}
              placeholder="U36910GJ1998PTC034567"
              className="font-mono"
            />
          </Field>
        </div>
      </Section>

      {/* ── Tax identifiers ───────────────────────────── */}
      <Section
        title="Tax identifiers"
        icon={Percent}
        description="Used on invoices and GST filings."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="GSTIN" hint="15 characters — state code + PAN + entity + Z + check digit">
            <Input
              value={form.gstin}
              onChange={(e) => set('gstin', e.target.value.toUpperCase())}
              placeholder="24XXXXX1234X1Z5"
              maxLength={15}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="PAN" hint="10 characters — 5 letters + 4 digits + 1 letter">
            <Input
              value={form.pan}
              onChange={(e) => set('pan', e.target.value.toUpperCase())}
              placeholder="XXXXX1234X"
              maxLength={10}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="State code" hint="GST state code — 24 is Gujarat">
            <Input
              value={form.state_code}
              onChange={(e) => set('state_code', e.target.value)}
              placeholder="24"
              maxLength={2}
              className="font-mono"
            />
          </Field>
          <Field label="State name">
            <Input
              value={form.state_name}
              onChange={(e) => set('state_name', e.target.value)}
              placeholder="Gujarat"
            />
          </Field>
        </div>
      </Section>

      {/* ── Address ───────────────────────────────────── */}
      <Section
        title="Address"
        icon={MapPin}
        description="Registered place of business — shown on every invoice."
      >
        <div className="space-y-4">
          <Field label="Street address">
            <Input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="33, Sant tukaram Society-2, Nr. Ramji Temple, Palanpur Jakatnaka"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Surat"
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                placeholder="Gujarat"
              />
            </Field>
            <Field label="Pincode">
              <Input
                value={form.pincode}
                onChange={(e) => set('pincode', e.target.value)}
                placeholder="395009"
                maxLength={6}
                className="font-mono"
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── Contact ───────────────────────────────────── */}
      <Section
        title="Contact"
        icon={Phone}
        description="Appears in invoice header and storefront footer."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91 7096785900"
              className="font-mono"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contact@minalgems.com"
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="https://minalgems.com"
            />
          </Field>
        </div>
      </Section>

      {/* ── Bank details ──────────────────────────────── */}
      <Section
        title="Bank details"
        icon={Landmark}
        description="Printed on invoices for NEFT / RTGS payments."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Bank name">
            <Input
              value={form.bank_name}
              onChange={(e) => set('bank_name', e.target.value)}
              placeholder="HDFC Bank"
            />
          </Field>
          <Field label="Branch">
            <Input
              value={form.bank_branch}
              onChange={(e) => set('bank_branch', e.target.value)}
              placeholder="Ring Road, Surat"
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.bank_account}
              onChange={(e) => set('bank_account', e.target.value)}
              placeholder="50100012345678"
              className="font-mono"
            />
          </Field>
          <Field label="IFSC code">
            <Input
              value={form.bank_ifsc}
              onChange={(e) => set('bank_ifsc', e.target.value.toUpperCase())}
              placeholder="HDFC0001234"
              maxLength={11}
              className="font-mono uppercase"
            />
          </Field>
        </div>
      </Section>

      {/* ── Invoice defaults ──────────────────────────── */}
      <Section
        title="Invoice defaults"
        icon={FileText}
        description="Prefix, HSN, and terms applied to new invoices."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Invoice prefix" hint="e.g. INV produces INV-2026-0001">
            <Input
              value={form.invoice_prefix}
              onChange={(e) => set('invoice_prefix', e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={10}
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Default HSN code" hint="7113 is standard for jewellery">
            <Input
              value={form.default_hsn}
              onChange={(e) => set('default_hsn', e.target.value)}
              placeholder="7113"
              maxLength={8}
              className="font-mono"
            />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="Invoice terms" hint="Shown at the bottom of printed invoices">
            <textarea
              value={form.invoice_terms}
              onChange={(e) => set('invoice_terms', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Goods once sold will not be taken back."
            />
          </Field>
          <Field label="Report footer terms" hint="Shown on PDF reports">
            <textarea
              value={form.report_terms}
              onChange={(e) => set('report_terms', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="For internal use only."
            />
          </Field>
        </div>
      </Section>

      {/* ── Tax & accounting defaults ─────────────────── */}
      <Section
        title="Tax & accounting defaults"
        icon={CreditCard}
        description="Applied system-wide unless overridden on individual invoices."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Default GST rate" hint="Jewellery is typically 3%">
            <select
              value={form.default_gst_rate}
              onChange={(e) => set('default_gst_rate', e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </Field>
          <Field label="Financial year start" hint="Usually April in India">
            <select
              value={form.financial_year_start_month}
              onChange={(e) => set('financial_year_start_month', e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accounting module" hint="Enables double-entry posting">
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
              <input
                type="checkbox"
                checked={form.accounting_enabled}
                onChange={(e) => set('accounting_enabled', e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Enabled
            </label>
          </Field>
        </div>
      </Section>

      {/* Sticky save bar on mobile */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white p-3 lg:hidden">
        <Button
          type="submit"
          disabled={saving || uploading}
          className="w-full gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save company settings'}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string
  icon: any
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  )
}