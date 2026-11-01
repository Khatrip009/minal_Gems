'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Known fields rendered as structured inputs.
// Anything else already in `kyc` is preserved and shown in the advanced panel.
const KNOWN_KEYS = [
  'aadhaar_number',
  'pan_number',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'pincode',
  'bank_account_holder',
  'bank_account_number',
  'bank_ifsc',
  'bank_name',
  'emergency_name',
  'emergency_phone',
  'notes',
] as const

type KnownKey = (typeof KNOWN_KEYS)[number]
type FormState = Record<KnownKey, string>

function emptyForm(): FormState {
  return {
    aadhaar_number: '',
    pan_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    emergency_name: '',
    emergency_phone: '',
    notes: '',
  }
}

function hydrate(initial: Record<string, unknown>): {
  form: FormState
  extra: Record<string, unknown>
} {
  const form = emptyForm()
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(initial ?? {})) {
    if ((KNOWN_KEYS as readonly string[]).includes(k)) {
      form[k as KnownKey] = v == null ? '' : String(v)
    } else {
      extra[k] = v
    }
  }
  return { form, extra }
}

const VALIDATORS: Partial<
  Record<KnownKey, { test: (v: string) => boolean; msg: string }>
> = {
  aadhaar_number: {
    test: (v) => /^\d{12}$/.test(v.replace(/\s/g, '')),
    msg: 'Aadhaar must be 12 digits',
  },
  pan_number: {
    test: (v) => /^[A-Z]{5}\d{4}[A-Z]$/i.test(v),
    msg: 'PAN must be in format AAAAA0000A',
  },
  pincode: {
    test: (v) => /^\d{6}$/.test(v),
    msg: 'Pincode must be 6 digits',
  },
  bank_ifsc: {
    test: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v),
    msg: 'IFSC must be in format AAAA0XXXXXX',
  },
  emergency_phone: {
    test: (v) => /^[\d\s+\-]{6,15}$/.test(v),
    msg: 'Enter a valid phone number',
  },
}

export function KycForm({
  craftsmanId,
  initial,
}: {
  craftsmanId: string
  initial: Record<string, unknown>
}) {
  const router = useRouter()
  const hydrated = useMemo(() => hydrate(initial), [initial])

  const [form, setForm] = useState<FormState>(hydrated.form)
  const [extra, setExtra] = useState<Record<string, unknown>>(hydrated.extra)
  const [extraJson, setExtraJson] = useState(JSON.stringify(hydrated.extra, null, 2))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<KnownKey, string>>>({})
  const [saving, setSaving] = useState(false)

  function set<K extends KnownKey>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<Record<KnownKey, string>> = {}
    const entries = Object.entries(VALIDATORS) as [
      KnownKey,
      { test: (v: string) => boolean; msg: string },
    ][]
    for (const [k, rule] of entries) {
      const v = form[k].trim()
      if (v && !rule.test(v)) next[k] = rule.msg
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function save() {
    if (!validate()) {
      toast.error('Please fix the highlighted fields', { duration: 6000 })
      return
    }

    // Merge advanced JSON — cannot contain structured keys (they'd collide)
    let extraToSave: Record<string, unknown> = extra
    if (showAdvanced) {
      try {
        extraToSave = JSON.parse(extraJson || '{}')
        for (const k of KNOWN_KEYS) {
          if (k in extraToSave) {
            toast.error(
              `Remove "${k}" from advanced JSON — it's already a structured field above`,
              { duration: 8000 },
            )
            return
          }
        }
      } catch (e) {
        toast.error('Invalid JSON in advanced section: ' + (e as Error).message, {
          duration: 8000,
        })
        return
      }
    }

    // Final payload: extra first, then known fields (empty strings omitted)
    const payload: Record<string, unknown> = { ...extraToSave }
    for (const k of KNOWN_KEYS) {
      const v = form[k].trim()
      if (v) payload[k] = v
    }

    setSaving(true)
    const { error } = await createClient()
      .from('craftsmen')
      .update({ kyc: payload })
      .eq('id', craftsmanId)
    setSaving(false)

    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success('KYC updated')
    setExtra(extraToSave)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Section title="Identity">
        <Field
          label="Aadhaar number"
          value={form.aadhaar_number}
          onChange={(v) => set('aadhaar_number', v)}
          error={errors.aadhaar_number}
          placeholder="1234 5678 9012"
        />
        <Field
          label="PAN number"
          value={form.pan_number}
          onChange={(v) => set('pan_number', v.toUpperCase())}
          error={errors.pan_number}
          placeholder="ABCDE1234F"
          maxLength={10}
        />
      </Section>

      <Section title="Address">
        <Field
          label="Address line 1"
          value={form.address_line1}
          onChange={(v) => set('address_line1', v)}
          className="md:col-span-2"
        />
        <Field
          label="Address line 2"
          value={form.address_line2}
          onChange={(v) => set('address_line2', v)}
          className="md:col-span-2"
        />
        <Field label="City" value={form.city} onChange={(v) => set('city', v)} />
        <Field label="State" value={form.state} onChange={(v) => set('state', v)} />
        <Field
          label="Pincode"
          value={form.pincode}
          onChange={(v) => set('pincode', v.replace(/\D/g, ''))}
          error={errors.pincode}
          placeholder="400001"
          maxLength={6}
        />
      </Section>

      <Section title="Bank account">
        <Field
          label="Account holder name"
          value={form.bank_account_holder}
          onChange={(v) => set('bank_account_holder', v)}
        />
        <Field
          label="Bank name"
          value={form.bank_name}
          onChange={(v) => set('bank_name', v)}
        />
        <Field
          label="Account number"
          value={form.bank_account_number}
          onChange={(v) => set('bank_account_number', v.replace(/\D/g, ''))}
        />
        <Field
          label="IFSC code"
          value={form.bank_ifsc}
          onChange={(v) => set('bank_ifsc', v.toUpperCase())}
          error={errors.bank_ifsc}
          placeholder="HDFC0001234"
          maxLength={11}
        />
      </Section>

      <Section title="Emergency contact">
        <Field
          label="Name"
          value={form.emergency_name}
          onChange={(v) => set('emergency_name', v)}
        />
        <Field
          label="Phone"
          value={form.emergency_phone}
          onChange={(v) => set('emergency_phone', v)}
          error={errors.emergency_phone}
        />
      </Section>

      <Section title="Notes">
        <div className="md:col-span-2">
          <Label className="text-xs text-slate-600">Free-form notes</Label>
          <textarea
            className="mt-1 h-24 w-full rounded border border-slate-200 p-2 text-sm"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Anything else worth recording…"
          />
        </div>
      </Section>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-sm font-medium text-slate-700 hover:underline"
        >
          {showAdvanced ? '▾ Hide' : '▸ Show'} advanced fields (JSON)
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Only for custom data that isn&apos;t covered above. Values here are preserved on save.
        </p>
        {showAdvanced && (
          <textarea
            className="mt-3 h-40 w-full rounded border border-slate-200 bg-white p-2 font-mono text-xs"
            value={extraJson}
            onChange={(e) => setExtraJson(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save KYC'}
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b border-slate-100 pb-1 text-sm font-medium text-slate-700">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  className,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  className?: string
  maxLength?: number
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input
        className={`mt-1 ${error ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}