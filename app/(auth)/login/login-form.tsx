'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { loginAction } from '@/lib/auth/actions'

const STAFF_ROLES = ['admin', 'manager', 'sales', 'accountant']

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ email: '', password: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim()) return toast.error('Enter your email')
    if (!form.password) return toast.error('Enter your password')

    startTransition(async () => {
      try {
        const res = await loginAction({
          email: form.email,
          password: form.password,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Welcome back')
        if (STAFF_ROLES.includes(res.role)) {
          router.push('/dashboard')
        } else {
          router.push(redirectTo)
        }
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Login failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Email</span>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          autoComplete="email"
          autoFocus
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-stone-600">Password</span>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-xs text-stone-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-amber-700 hover:text-amber-800"
        >
          Create one
        </Link>
      </p>
    </form>
  )
}