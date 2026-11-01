'use client'

import { useState, useTransition } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile, updatePassword } from '@/lib/storefront/account'

export function ProfileForm({
  initialName,
  initialPhone,
  email,
}: {
  initialName: string
  initialPhone: string
  email: string
}) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    full_name: initialName,
    phone: initialPhone,
  })

  const [pwPending, startPwTransition] = useTransition()
  const [pw, setPw] = useState({
    new_password: '',
    confirm_password: '',
  })

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await updateProfile({
          full_name: form.full_name,
          phone: form.phone,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Profile updated')
      } catch (err) {
        console.error('[profile] update failed:', err)
        toast.error(
          err instanceof Error ? err.message : 'Could not update profile',
        )
      }
    })
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pw.new_password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (pw.new_password !== pw.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    startPwTransition(async () => {
      try {
        const res = await updatePassword(pw.new_password)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Password changed')
        setPw({ new_password: '', confirm_password: '' })
      } catch (err) {
        console.error('[profile] password change failed:', err)
        toast.error(
          err instanceof Error ? err.message : 'Could not change password',
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Personal info */}
      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold mb-4">
          Personal info
        </h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-md">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Full name
            </span>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              autoComplete="name"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">Phone</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              autoComplete="tel"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">Email</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="email"
                value={email}
                readOnly
                disabled
                className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 cursor-not-allowed"
              />
              <Mail className="h-4 w-4 text-stone-400 shrink-0" />
            </div>
            <span className="mt-1 block text-[10px] text-stone-500">
              Contact us on WhatsApp to change your email
            </span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold mb-4">
          Change password
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              New password
            </span>
            <input
              type="password"
              value={pw.new_password}
              onChange={(e) =>
                setPw((p) => ({ ...p, new_password: e.target.value }))
              }
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Confirm new password
            </span>
            <input
              type="password"
              value={pw.confirm_password}
              onChange={(e) =>
                setPw((p) => ({ ...p, confirm_password: e.target.value }))
              }
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </label>

          <button
            type="submit"
            disabled={pwPending}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {pwPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pwPending ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  )
}