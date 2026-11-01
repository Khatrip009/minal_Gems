import { requireRole } from '@/lib/guard'
import { getCompanySettings } from '@/lib/company-settings'
import { CompanySettingsForm } from './company-settings-form'

export const dynamic = 'force-dynamic'

export default async function CompanySettingsPage() {
  const { supabase } = await requireRole(['admin', 'manager'])
  const settings = await getCompanySettings(supabase)

  return <CompanySettingsForm initial={settings} />
}