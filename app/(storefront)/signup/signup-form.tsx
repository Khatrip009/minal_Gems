'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { signupAction } from '@/lib/auth/actions'

export function SignupForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [emailForConfirmation, setEmailForConfirmation] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.full_name.trim()) return toast.error('Enter your name')
    if (!form.email.includes('@')) return toast.error('Enter a valid email')
    if (!form.phone.trim()) return toast.error('Enter your phone')
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters')
    }
    if (form.password !== form.confirm_password) {
      return toast.error('Passwords do not match')
    }

    startTransition(async () => {
      try {
        const res = await signupAction({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.needsConfirmation) {
          setEmailForConfirmation(form.email.trim())
          setConfirmationPending(true)
          return
        }
        toast.success('Welcome!')
        router.push('/shop')
        router.refresh()
      } catch (err: any) {
        toast.error(err?.message ?? 'Signup failed')
      }
    })
  }

  if (confirmationPending) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Mail className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 text-lg font-semibold text-emerald-900">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-emerald-800">
          We&apos;ve sent a confirmation link to{' '}
          <strong className="break-all">{emailForConfirmation}</strong>. Click
          it to activate your account.
        </p>
        <p className="mt-3 text-xs text-emerald-700">
          Didn&apos;t receive it? Check spam, or{' '}
          <button
            onClick={() => setConfirmationPending(false)}
            className="underline font-medium"
          >
            try another email
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Full name"
        value={form.full_name}
        onChange={(v) => set('full_name', v)}
        autoComplete="name"
      />
      <Field
        label="Email"
        type="email"
        value={form.email}
        onChange={(v) => set('email', v)}
        autoComplete="email"
      />
      <Field
        label="Phone"
        type="tel"
        value={form.phone}
        onChange={(v) => set('phone', v)}
        autoComplete="tel"
      />
      <Field
        label="Password"
        type="password"
        value={form.password}
        onChange={(v) => set('password', v)}
        autoComplete="new-password"
        hint="At least 6 characters"
      />
      <Field
        label="Confirm password"
        type="password"
        value={form.confirm_password}
        onChange={(v) => set('confirm_password', v)}
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-[11px] text-stone-500 text-center leading-relaxed">
        By creating an account you agree to our{' '}
        <Link href="/policies/terms" className="underline hover:text-stone-700">
          Terms
        </Link>{' '}
        and{' '}
        <Link
          href="/policies/privacy"
          className="underline hover:text-stone-700"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
      />
      {hint && (
        <span className="mt-1 block text-[10px] text-stone-500">{hint}</span>
      )}
    </label>
  )
}