'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/primitives/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { amountInWords } from '@/lib/number-to-words'
import {
  X,
  Search,
  Package,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Scale,
  Gem,
  Plus,
  Trash2,
} from 'lucide-react'

type Customer = {
  id: string
  name: string
  phone: string | null
  gstin: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

// ★ Added stone_master_id — needed to snapshot quality on submit
type StoneLine = {
  key: string
  category: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  carat_each: number
  pcs: number
  carat_total: number
  rate_per_carat: number
  value: number
  source: 'actual' | 'design'
  stone_master_id: string | null
}

type Item = {
  id: string
  inventory_tag: string
  status: string
  net_metal_weight_g: number | string
  net_fine_weight_g: number | string
  gross_weight_g: number | string
  stone_pcs_total: number
  stone_carat_total: number | string
  cost_price: number | string
  making_charge_amount: number | string | null
  floor_price: number | string | null
  metal_purity_id: string | null
  design_name: string | null
  image_url: string | null
  metal_display: string
  stone_lines?: StoneLine[]
  stones?: Array<{
    shape: string
    color: string
    clarity: string
    cut: string
    carat: number | string
  }>
}

type MetalData = { purity_id: string; code: string; rate_per_gram: number }

type LineItem = {
  key: string
  inventory_item_id: string | null
  description: string
  sale_price: string
  tax_rate: string
  expanded: boolean
  metal_value: number
  stone_value: number
  making_value: number
  net_metal_weight_g: number
  stone_carat_total: number
  stone_pcs_total: number
  image_url: string | null
  metal_display: string
  stone_lines: StoneLine[]
}

type Payment = {
  key: string
  method: 'cash' | 'card' | 'upi' | 'bank' | 'cheque'
  amount: string
  reference: string
}

const TAX_RATES = ['0', '3', '5', '18'] as const
const PAYMENT_METHODS: Payment['method'][] = [
  'cash',
  'card',
  'upi',
  'bank',
  'cheque',
]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}
const fmtWeight = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}

const STONE_CATEGORY_LABELS: Record<string, string> = {
  diamond: 'Diamond',
  gemstone: 'Gemstone',
  lab_grown: 'Lab-Grown',
  synthetic: 'Synthetic',
  other: 'Stone',
}
function stoneCategoryLabel(cat: string | null): string {
  if (!cat) return 'Stone'
  return STONE_CATEGORY_LABELS[cat] ?? cat
}

function newFreeLine(): LineItem {
  return {
    key: crypto.randomUUID(),
    inventory_item_id: null,
    description: '',
    sale_price: '',
    tax_rate: '3',
    expanded: false,
    metal_value: 0,
    stone_value: 0,
    making_value: 0,
    net_metal_weight_g: 0,
    stone_carat_total: 0,
    stone_pcs_total: 0,
    image_url: null,
    metal_display: '',
    stone_lines: [],
  }
}

function itemToLine(item: Item, stoneValue: number): LineItem {
  const cost = Number(item.cost_price || 0)
  const making = Number(item.making_charge_amount || 0)
  const floor = Number(item.floor_price || 0)
  const defaultPrice = floor > 0 ? floor : cost + making

  return {
    key: crypto.randomUUID(),
    inventory_item_id: item.id,
    description: item.design_name ?? item.inventory_tag,
    sale_price: defaultPrice.toFixed(2),
    tax_rate: '3',
    expanded: false,
    metal_value: Math.max(0, cost - making - stoneValue),
    stone_value: stoneValue,
    making_value: making,
    net_metal_weight_g: Number(item.net_metal_weight_g || 0),
    stone_carat_total: Number(item.stone_carat_total || 0),
    stone_pcs_total: item.stone_pcs_total,
    image_url: item.image_url,
    metal_display: item.metal_display,
    stone_lines: item.stone_lines ?? [],
  }
}

export function NewInvoiceForm({
  customers,
  availableItems,
  presetInventoryId,
  metalRates,
  stoneCostMap,
  currentUserId,
}: {
  customers: Customer[]
  availableItems: Item[]
  presetInventoryId?: string
  metalRates: MetalData[]
  stoneCostMap: Record<string, number>
  currentUserId: string | null
}) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Goods once sold will not be taken back.')
  const [discount, setDiscount] = useState('')
  const [showBreakdown, setShowBreakdown] = useState(true)
  const [items, setItems] = useState<LineItem[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])

  const [pickerQuery, setPickerQuery] = useState('')
  const pickerSearchRef = useRef<HTMLInputElement>(null)

  const [goldMode, setGoldMode] = useState<'buyback' | 'customer_gold'>(
    'buyback',
  )
  const [buybackWeight, setBuybackWeight] = useState('')
  const [buybackPurityId, setBuybackPurityId] = useState('')
  const [buybackRate, setBuybackRate] = useState('')
  const [buybackDeduction, setBuybackDeduction] = useState('10')

  useEffect(() => {
    if (!presetInventoryId) return
    const found = availableItems.find((i) => i.id === presetInventoryId)
    if (!found) return
    setItems((prev) => {
      if (prev.some((li) => li.inventory_item_id === found.id)) return prev
      return [...prev, itemToLine(found, stoneCostMap[found.id] || 0)]
    })
  }, [presetInventoryId, availableItems, stoneCostMap])

  useEffect(() => {
    if (!buybackPurityId) return
    const rateInfo = metalRates.find((r) => r.purity_id === buybackPurityId)
    if (rateInfo && rateInfo.rate_per_gram > 0) {
      setBuybackRate(String(rateInfo.rate_per_gram))
    }
  }, [buybackPurityId, metalRates])

  useEffect(() => {
    if (pickerOpen) {
      const t = setTimeout(() => pickerSearchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setPickerQuery('')
    }
  }, [pickerOpen])

  const buybackPurity = metalRates.find((r) => r.purity_id === buybackPurityId)

  function addPiece(item: Item) {
    if (items.some((li) => li.inventory_item_id === item.id)) {
      toast.error('That piece is already on the invoice')
      return
    }
    setItems((prev) => [...prev, itemToLine(item, stoneCostMap[item.id] || 0)])
    setPickerOpen(false)
    toast.success(`${item.design_name ?? item.inventory_tag} added`)
  }
  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((i) => i.key !== key))
  const updateItem = (key: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const addPayment = () =>
    setPayments((p) => [
      ...p,
      { key: crypto.randomUUID(), method: 'cash', amount: '', reference: '' },
    ])
  const updatePayment = (key: string, patch: Partial<Payment>) =>
    setPayments((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const removePayment = (key: string) =>
    setPayments((p) => p.filter((x) => x.key !== key))

  const buybackValue = useMemo(() => {
    const weight = Number(buybackWeight) || 0
    const rate = Number(buybackRate) || 0
    if (weight <= 0 || rate <= 0) return 0
    const ded = Math.min(100, Math.max(0, Number(buybackDeduction) || 0))
    return weight * (1 - ded / 100) * rate
  }, [buybackWeight, buybackRate, buybackDeduction])

  const computed = useMemo(() => {
    const lines = items.map((i) => {
      const price = Number(i.sale_price) || 0
      const rate = Number(i.tax_rate) || 0
      return { price, rate, tax: (price * rate) / 100 }
    })
    const subtotal = lines.reduce((a, l) => a + l.price, 0)
    const totalTax = lines.reduce((a, l) => a + l.tax, 0)

    const maxDiscount = Math.max(0, subtotal + totalTax - 0.01)
    const requestedDiscount = Number(discount) || 0
    const discountAmt = Math.min(requestedDiscount, maxDiscount)
    const discountCapped = requestedDiscount > maxDiscount

    const total = subtotal + totalTax - discountAmt
    const balanceDue = Math.max(0, total - buybackValue)
    const paidNow = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
    const remaining = Math.max(0, balanceDue - paidNow)

    return {
      subtotal,
      totalTax,
      discountAmt,
      discountCapped,
      total,
      balanceDue,
      paidNow,
      remaining,
    }
  }, [items, discount, buybackValue, payments])

  const filteredPickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return availableItems
    const terms = q.split(/\s+/)
    return availableItems.filter((item) => {
      const haystack = [
        item.inventory_tag,
        item.design_name ?? '',
        item.metal_display ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [availableItems, pickerQuery])

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (!customerId) return toast.error('Select a customer')
    if (items.length === 0) return toast.error('Add at least one item')
    const badLine = items.find((i) => !(Number(i.sale_price) > 0))
    if (badLine)
      return toast.error(
        `"${badLine.description || 'Item'}" needs a price greater than 0`,
      )
    if (computed.paidNow > computed.balanceDue + 0.01) {
      return toast.error(
        `Payments (₹${fmtMoney(computed.paidNow)}) exceed balance (₹${fmtMoney(
          computed.balanceDue,
        )})`,
      )
    }
    if (buybackValue > 0 && (!buybackPurityId || Number(buybackWeight) <= 0)) {
      return toast.error(
        'Complete the gold-exchange details (weight + purity)',
      )
    }

    setSaving(true)
    try {
      const itemsPayload = items.map((i) => ({
        inventory_item_id: i.inventory_item_id,
        description: i.description.trim() || 'Item',
        amount: Number(i.sale_price),
        tax_rate: Number(i.tax_rate) || 0,
      }))

      const { data: invoiceId, error: rpcErr } = await supabase.rpc(
        'rpc_create_invoice',
        {
          p_customer_id: customerId,
          p_items: itemsPayload,
          p_tax_amount: computed.totalTax,
          p_discount: computed.discountAmt,
        },
      )
      if (rpcErr) throw rpcErr
      if (!invoiceId) throw new Error('Invoice creation returned no id')

      // ★ SNAPSHOT STONES into invoice_item_stones
      // Soft-error — if this fails we still proceed with the invoice,
      // but the invoice print won't show stone quality.
      try {
        const { data: createdItems } = await supabase
          .from('invoice_items')
          .select('id, inventory_item_id')
          .eq('invoice_id', invoiceId)

        if (createdItems && createdItems.length > 0) {
          const stoneInserts: any[] = []
          for (const line of items) {
            if (!line.inventory_item_id) continue
            if (line.stone_lines.length === 0) continue
            const createdItem = createdItems.find(
              (ci) => ci.inventory_item_id === line.inventory_item_id,
            )
            if (!createdItem) continue
            for (const s of line.stone_lines) {
              if (!(s.carat_total > 0)) continue
              stoneInserts.push({
                invoice_item_id: createdItem.id,
                stone_master_id: s.stone_master_id ?? null,
                category: s.category,
                shape: s.shape,
                color: s.color,
                clarity: s.clarity,
                cut: s.cut,
                carat: s.carat_total,
                pcs: s.pcs,
                rate_per_carat: s.rate_per_carat || 0,
                sale_value: s.value || 0,
              })
            }
          }
          if (stoneInserts.length > 0) {
            const { error: stoneErr } = await supabase
              .from('invoice_item_stones')
              .insert(stoneInserts)
            if (stoneErr) {
              console.warn(
                '[POS] stone snapshot failed (non-fatal):',
                stoneErr,
              )
            }
          }
        }
      } catch (snapErr) {
        console.warn('[POS] stone snapshot skipped:', snapErr)
      }

      const { error: metaErr } = await supabase
        .from('invoices')
        .update({
          invoice_date: invoiceDate,
          notes: notes || null,
          terms: terms || null,
          show_breakdown: showBreakdown,
          salesperson_id: isUuid(currentUserId) ? currentUserId : null,
          channel: 'pos',
        })
        .eq('id', invoiceId)
      if (metaErr) throw metaErr

      if (buybackValue > 0 && buybackPurityId) {
        const { data: purity, error: purityErr } = await supabase
          .from('metal_purities')
          .select('purity_percent')
          .eq('id', buybackPurityId)
          .single()
        if (purityErr) throw purityErr

        const grossWeight = Number(buybackWeight)
        const purityPct = Number(purity.purity_percent)
        const fineWeight = (grossWeight * purityPct) / 100

        const modeLabel =
          goldMode === 'customer_gold' ? 'Customer gold' : 'Buyback'
        const goldRef = [
          modeLabel,
          `${grossWeight.toFixed(3)}g`,
          buybackPurity?.code ?? '',
          Number(buybackRate) > 0
            ? `@ ₹${Number(buybackRate).toFixed(2)}/g`
            : '',
          Number(buybackDeduction) > 0 ? `−${Number(buybackDeduction)}%` : '',
        ]
          .filter(Boolean)
          .join(' ')

        const { error: payErr } = await supabase.rpc('rpc_record_payment', {
          p_invoice_id: invoiceId,
          p_amount: buybackValue,
          p_method: 'gold_exchange',
          p_reference: goldRef,
        })
        if (payErr) throw payErr

        const { data: lot, error: lotErr } = await supabase
          .from('metal_lots')
          .insert({
            purity_id: buybackPurityId,
            rate_per_gram: Number(buybackRate),
            source: 'buyback',
            packet_tag: `BB-${Date.now()}-${crypto
              .randomUUID()
              .slice(0, 8)
              .toUpperCase()}`,
            notes: `Gold received against Invoice ${invoiceId}`,
          })
          .select('id')
          .single()
        if (lotErr) throw lotErr

        const { error: txErr } = await supabase
          .from('metal_transactions')
          .insert({
            metal_lot_id: lot.id,
            txn_type: 'buyback',
            gross_weight_change_g: grossWeight,
            purity_percent: purityPct,
            fine_weight_change_g: fineWeight,
            reference_type: 'invoice',
            reference_id: invoiceId,
            notes: `Gold received against Invoice ${invoiceId}`,
            performed_by: isUuid(currentUserId) ? currentUserId : null,
          })
        if (txErr) throw txErr
      }

      for (const p of payments) {
        const amount = Number(p.amount)
        if (!amount || amount <= 0) continue
        const { error: payErr } = await supabase.rpc('rpc_record_payment', {
          p_invoice_id: invoiceId,
          p_amount: amount,
          p_method: p.method,
          p_reference: p.reference.trim() || null,
        })
        if (payErr) throw payErr
      }

      toast.success('Invoice created')
      router.push(`/invoices/${invoiceId}`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-24 lg:pb-6">
      <PageHeader
        title="New Invoice"
        description="Create a GST invoice for one or more pieces."
        backHref="/invoices"
        backLabel="Back to invoices"
      />

      {/* Customer & date */}
      <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-fg">
          Customer & date
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>
              Customer <span className="text-danger">*</span>
            </Label>
            <div className="mt-1 flex gap-2">
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `· ${c.phone}` : ''}
                  </option>
                ))}
              </select>
              <Link href="/customers">
                <Button type="button" variant="outline" size="md">
                  + New
                </Button>
              </Link>
            </div>
          </div>
          <div>
            <Label>
              Invoice date <span className="text-danger">*</span>
            </Label>
            <Input
              required
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-fg">
            Items <span className="text-fg-muted">({items.length})</span>
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems([...items, newFreeLine()])}
            >
              <Plus className="h-3.5 w-3.5" /> Custom item
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={availableItems.length === 0}
            >
              <Package className="h-3.5 w-3.5" /> Add piece
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-strong bg-surface-muted p-8 text-center">
            <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-fg-subtle" />
            <p className="text-sm font-medium text-fg">No items yet</p>
            <p className="mt-1 text-sm text-fg-muted">
              Add a finished piece from inventory or create a custom line.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const lineTax =
                (Number(item.sale_price) * Number(item.tax_rate)) / 100
              return (
                <div
                  key={item.key}
                  className="rounded-lg border border-border bg-surface-muted/40"
                >
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Gem className="h-6 w-6 text-fg-subtle" />
                        </div>
                      )}
                    </div>

                    <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-12">
                      <div className="col-span-2 sm:col-span-6">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.key, {
                              description: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-xs">Price (₹)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={item.sale_price}
                          onChange={(e) =>
                            updateItem(item.key, {
                              sale_price: e.target.value,
                            })
                          }
                          className="mt-1 text-right tabular-nums"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-xs">GST %</Label>
                        <select
                          value={item.tax_rate}
                          onChange={(e) =>
                            updateItem(item.key, { tax_rate: e.target.value })
                          }
                          className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2.5 text-sm tabular-nums"
                        >
                          {TAX_RATES.map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1 sm:col-span-1">
                        <Label className="text-xs">Tax</Label>
                        <div className="mt-1 rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums">
                          {fmtMoney(lineTax)}
                        </div>
                      </div>
                      <div className="col-span-1 flex items-end justify-end sm:col-span-1">
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="sm"
                          onClick={() => removeItem(item.key)}
                          aria-label="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {item.inventory_item_id && (
                    <div className="border-t border-border px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(item.key, { expanded: !item.expanded })
                        }
                        className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
                      >
                        {item.expanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Breakdown & details
                      </button>
                      {item.expanded && (
                        <div className="mt-3 rounded-md border border-border bg-surface p-3">
                          <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                            <div>
                              <dt className="text-fg-muted">Metal</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                {item.metal_display || '—'}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-fg-muted">Net weight</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                {fmtWeight(item.net_metal_weight_g)} g
                              </dd>
                            </div>
                            <div>
                              <dt className="text-fg-muted">Metal value</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                ₹ {fmtMoney(item.metal_value)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-fg-muted">Making</dt>
                              <dd className="mt-0.5 font-medium tabular-nums">
                                ₹ {fmtMoney(item.making_value)}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-3 border-t border-border pt-3">
                            <div className="mb-2 flex items-center justify-between">
                              <dt className="text-xs text-fg-muted">
                                Stones ({item.stone_pcs_total} pcs ·{' '}
                                {item.stone_carat_total.toFixed(3)} ct)
                              </dt>
                              <span className="text-xs font-semibold tabular-nums text-fg">
                                ₹ {fmtMoney(item.stone_value)}
                              </span>
                            </div>

                            {item.stone_lines.length > 0 ? (
                              <div className="space-y-1.5">
                                {item.stone_lines.map((s) => {
                                  const parts: string[] = [
                                    stoneCategoryLabel(s.category),
                                  ]
                                  if (s.shape) parts.push(s.shape)
                                  if (s.color && s.clarity)
                                    parts.push(`${s.color}/${s.clarity}`)
                                  else if (s.color) parts.push(s.color)
                                  else if (s.clarity) parts.push(s.clarity)
                                  if (s.cut && s.cut !== 'N/A')
                                    parts.push(s.cut)
                                  const header = parts.join(' · ')

                                  return (
                                    <div
                                      key={s.key}
                                      className="rounded-md border border-border bg-surface-muted/50 px-2.5 py-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-1.5">
                                          <Gem className="mt-0.5 h-3 w-3 shrink-0 text-fg-subtle" />
                                          <div>
                                            <p className="text-[11px] font-medium text-fg">
                                              {header}
                                              {s.source === 'design' && (
                                                <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                                                  est.
                                                </span>
                                              )}
                                              {s.source === 'actual' &&
                                                !s.shape &&
                                                !s.color &&
                                                !s.clarity && (
                                                  <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">
                                                    quality n/a
                                                  </span>
                                                )}
                                            </p>
                                            <p className="mt-0.5 text-[10px] tabular-nums text-fg-muted">
                                              {s.pcs} pc
                                              {s.pcs !== 1 ? 's' : ''} ×{' '}
                                              {s.carat_each.toFixed(3)} ct ={' '}
                                              {s.carat_total.toFixed(3)} ct
                                              {s.rate_per_carat > 0 && (
                                                <>
                                                  {' '}
                                                  · ₹{' '}
                                                  {fmtMoney(s.rate_per_carat)}
                                                  /ct
                                                </>
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-fg">
                                          ₹ {fmtMoney(s.value)}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] italic text-fg-muted">
                                Per-stone details unavailable for this item.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Gold exchange + notes + summary */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-warning/30 bg-warning-bg p-5">
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Scale className="h-4 w-4" /> Gold exchange
              </h2>
              <div className="flex self-start rounded-lg bg-white/70 p-1 sm:self-auto">
                <button
                  type="button"
                  onClick={() => setGoldMode('buyback')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    goldMode === 'buyback'
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-fg-muted'
                  }`}
                >
                  Buyback
                </button>
                <button
                  type="button"
                  onClick={() => setGoldMode('customer_gold')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    goldMode === 'customer_gold'
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-fg-muted'
                  }`}
                >
                  Customer gold
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-xs">Weight (g)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  value={buybackWeight}
                  onChange={(e) => setBuybackWeight(e.target.value)}
                  className="mt-1 tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs">Purity</Label>
                <select
                  value={buybackPurityId}
                  onChange={(e) => setBuybackPurityId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
                >
                  <option value="">— Select —</option>
                  {metalRates.map((r) => (
                    <option key={r.purity_id} value={r.purity_id}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Rate (₹/g)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={buybackRate}
                  onChange={(e) => setBuybackRate(e.target.value)}
                  className="mt-1 tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs">Deduction %</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={buybackDeduction}
                  onChange={(e) => setBuybackDeduction(e.target.value)}
                  className="mt-1 tabular-nums"
                />
              </div>
            </div>

            {buybackValue > 0 && (
              <div className="mt-3 flex justify-between border-t border-warning/30 pt-2 text-sm font-semibold text-fg">
                <span>Exchange value</span>
                <span className="tabular-nums">₹ {fmtMoney(buybackValue)}</span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="space-y-4">
              <div>
                <Label htmlFor="invoice-notes" className="text-sm">
                  Notes
                </Label>
                <textarea
                  id="invoice-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  placeholder="Internal notes (not shown to customer)…"
                />
              </div>
              <div>
                <Label htmlFor="invoice-terms" className="text-sm">
                  Terms on invoice
                </Label>
                <textarea
                  id="invoice-terms"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showBreakdown}
                  onChange={(e) => setShowBreakdown(e.target.checked)}
                  className="rounded border-border-strong text-brand-600 focus:ring-brand-500"
                />
                Show metal / stone / making breakdown on invoice
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-fg">Summary</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Subtotal</dt>
                <dd className="tabular-nums">₹ {fmtMoney(computed.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Tax</dt>
                <dd className="tabular-nums">₹ {fmtMoney(computed.totalTax)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-fg-muted">Discount</dt>
                <dd className="flex items-center gap-1">
                  ₹{' '}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-7 w-24 text-right text-xs tabular-nums"
                  />
                </dd>
              </div>
              {computed.discountCapped && (
                <p className="text-[10px] text-amber-700">
                  Capped at ₹{fmtMoney(computed.discountAmt)} — invoice cannot
                  total zero.
                </p>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Invoice total</dt>
                <dd className="tabular-nums text-brand-700">
                  ₹ {fmtMoney(computed.total)}
                </dd>
              </div>
              {buybackValue > 0 && (
                <div className="flex justify-between font-medium text-warning">
                  <dt>Less: gold exchange</dt>
                  <dd className="tabular-nums">− ₹ {fmtMoney(buybackValue)}</dd>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Balance due</dt>
                <dd className="tabular-nums text-fg">
                  ₹ {fmtMoney(computed.balanceDue)}
                </dd>
              </div>
            </dl>
            {computed.total > 0 && (
              <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-[11px] uppercase tracking-wide text-fg-muted">
                {amountInWords(computed.total)}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">Payment</h2>
              <Button type="button" size="sm" variant="outline" onClick={addPayment}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            {payments.length === 0 && (
              <p className="mb-3 text-xs text-fg-muted">
                Leave empty to issue as <strong>unpaid</strong>. Add a line to
                record cash/card/UPI now.
              </p>
            )}

            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.key} className="grid grid-cols-12 gap-2">
                  <select
                    value={p.method}
                    onChange={(e) =>
                      updatePayment(p.key, {
                        method: e.target.value as Payment['method'],
                      })
                    }
                    className="col-span-4 rounded-md border border-border bg-surface px-2 py-2 text-xs capitalize"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={(e) =>
                      updatePayment(p.key, { amount: e.target.value })
                    }
                    className="col-span-5 h-9 text-right text-xs tabular-nums"
                  />
                  <Input
                    placeholder="Ref"
                    value={p.reference}
                    onChange={(e) =>
                      updatePayment(p.key, { reference: e.target.value })
                    }
                    className="col-span-2 h-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    size="sm"
                    onClick={() => removePayment(p.key)}
                    aria-label="Remove payment"
                    className="col-span-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Paid now</dt>
                <dd className="tabular-nums">₹ {fmtMoney(computed.paidNow)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Remaining</dt>
                <dd
                  className={`tabular-nums ${
                    computed.remaining > 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  ₹ {fmtMoney(computed.remaining)}
                </dd>
              </div>
            </dl>
          </div>

          <Button
            type="submit"
            className="hidden w-full lg:flex"
            size="lg"
            disabled={saving || items.length === 0}
          >
            {saving ? 'Creating…' : 'Create invoice & complete sale'}
          </Button>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface p-3 lg:hidden">
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={saving || items.length === 0}
        >
          {saving ? 'Creating…' : 'Create invoice'}
        </Button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add piece</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              ref={pickerSearchRef}
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filteredPickerItems.length === 1) {
                    addPiece(filteredPickerItems[0])
                  }
                }
              }}
              placeholder="Search by tag, design, or metal…"
              className="pl-9 pr-9"
              autoComplete="off"
            />
            {pickerQuery && (
              <button
                type="button"
                onClick={() => setPickerQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-subtle hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <p className="text-xs text-fg-muted">
            {pickerQuery
              ? `${filteredPickerItems.length} of ${availableItems.length} matching`
              : `${availableItems.length} available`}
          </p>

          <div className="max-h-96 overflow-y-auto rounded-md border border-border">
            {filteredPickerItems.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-sm font-medium text-fg">No matches</p>
                <p className="mt-1 text-xs text-fg-muted">
                  Nothing matches "{pickerQuery}". Try a different search.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredPickerItems.map((i) => {
                  const already = items.some(
                    (li) => li.inventory_item_id === i.id,
                  )
                  return (
                    <li
                      key={i.id}
                      className={`flex items-center gap-3 px-3 py-2 ${
                        already ? 'opacity-50' : 'hover:bg-surface-muted'
                      }`}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-surface-muted">
                        {i.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={i.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Gem className="m-2 h-6 w-6 text-fg-subtle" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">
                            {i.inventory_tag}
                          </span>
                          <span className="text-xs font-medium text-fg">
                            {i.design_name ?? '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-fg-muted">
                          <span>{i.metal_display}</span>
                          <span className="text-fg-subtle">·</span>
                          <span className="tabular-nums">
                            {fmtWeight(i.net_metal_weight_g)}g
                          </span>
                          {i.stone_pcs_total > 0 && (
                            <>
                              <span className="text-fg-subtle">·</span>
                              <span>{i.stone_pcs_total} stones</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addPiece(i)}
                        disabled={already}
                      >
                        {already ? 'Added' : 'Add'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}