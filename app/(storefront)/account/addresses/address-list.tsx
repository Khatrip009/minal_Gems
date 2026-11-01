'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MapPin, Pencil, Trash2, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAddress, setDefaultAddress } from '@/lib/storefront/account'

type Address = {
  id: string
  label: string | null
  name: string
  phone: string
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  country: string
  is_default: boolean
}

export function AddressList({ addresses }: { addresses: Address[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function handleDelete(id: string) {
    if (!window.confirm('Delete this address?')) return
    setBusyId(id)
    startTransition(async () => {
      const res = await deleteAddress(id)
      setBusyId(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Address deleted')
      router.refresh()
    })
  }

  function handleSetDefault(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const res = await setDefaultAddress(id)
      setBusyId(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Default address updated')
      router.refresh()
    })
  }

  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {addresses.map((a) => {
        const busy = busyId === a.id
        return (
          <li
            key={a.id}
            className="rounded-lg border border-stone-200 bg-white p-5 flex flex-col"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-stone-900">{a.name}</p>
                {a.label && (
                  <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-stone-500">
                    {a.label}
                  </span>
                )}
              </div>
              {a.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  <Star className="h-2.5 w-2.5 fill-amber-800" /> Default
                </span>
              )}
            </div>

            <div className="mt-3 text-sm text-stone-600 space-y-0.5 flex-1">
              <p>
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}
              </p>
              <p>
                {a.city}, {a.state} — {a.pincode}
              </p>
              <p>{a.country}</p>
              <p className="text-stone-500 text-xs mt-1">{a.phone}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2">
              <Link
                href={`/account/addresses/${a.id}/edit`}
                className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Link>
              {!a.is_default && (
                <button
                  onClick={() => handleSetDefault(a.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Star className="h-3 w-3" />
                  )}
                  Set default
                </button>
              )}
              <button
                onClick={() => handleDelete(a.id)}
                disabled={busy}
                className="ml-auto inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}