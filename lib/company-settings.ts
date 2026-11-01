import type { SupabaseClient } from '@supabase/supabase-js'

export type CompanySettings = {
  id: string
  name: string
  gstin: string | null
  pan: string | null
  state_code: string
  state_name: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  invoice_prefix: string
  financial_year_start_month: number
  default_gst_rate: number
  default_hsn: string | null
  invoice_terms: string | null
  report_terms: string | null
  bank_name: string | null
  bank_account: string | null
  bank_ifsc: string | null
  bank_branch: string | null
  company_registration: string | null
  accounting_enabled: boolean
  updated_at: string
}

const FALLBACK: CompanySettings = {
  id: 'default',
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Minal Gems',
  gstin: process.env.NEXT_PUBLIC_COMPANY_GSTIN ?? null,
  pan: null,
  state_code: '24',
  state_name: null,
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? null,
  city: null,
  state: null,
  pincode: null,
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? null,
  email: null,
  website: null,
  logo_url: null,
  invoice_prefix: 'INV',
  financial_year_start_month: 4,
  default_gst_rate: 3,
  default_hsn: '7113',
  invoice_terms: null,
  report_terms: null,
  bank_name: null,
  bank_account: null,
  bank_ifsc: null,
  bank_branch: null,
  company_registration: null,
  accounting_enabled: true,
  updated_at: new Date().toISOString(),
}

/**
 * Read the single company_settings row. Returns FALLBACK env-derived values
 * if the row doesn't exist yet (first run, migrations not applied, etc.)
 * so print pages never crash.
 */
export async function getCompanySettings(
  supabase: SupabaseClient,
): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[company-settings] load failed:', error)
    return FALLBACK
  }

  if (!data) return FALLBACK
  return data as CompanySettings
}

/** One-liner formatted address for display on invoices */
export function formatAddress(settings: CompanySettings): string {
  const parts = [
    settings.address,
    settings.city,
    settings.state,
    settings.pincode,
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.join(', ')
}

/** Format a state code like "24" into a display name */
export function stateName(settings: CompanySettings): string | null {
  return settings.state_name ?? settings.state ?? null
}