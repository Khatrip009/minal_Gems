'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Store, Gem, Check } from 'lucide-react'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export function NewRepairForm({ customers, craftsmen, soldItems }: { customers: any[], craftsmen: any[], soldItems: any[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [sourceType, setSourceType] = useState<'external' | 'in-house'>('in-house')
  
  const [form, setForm] = useState({
    customer_id: '',
    inventory_item_id: '',
    item_description: '',
    intake_weight_g: '',
    intake_stone_carat: '',
    intake_stone_pcs: '',
    making_charge_amount: '',      // Customer Charge
    craftsman_cost_amount: '',     // Craftsman Cost
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  })

  // Filter sold items based on the selected customer
  const customerItems = soldItems.filter(
    item => item.invoices?.customer_id === form.customer_id
  )

  // When a user selects a specific piece from our records, auto-fill the specs
  function handleSelectItem(inventoryItemId: string) {
    const item = customerItems.find(i => i.inventory_item_id === inventoryItemId)
    if (!item) {
      setForm(prev => ({ ...prev, inventory_item_id: '', item_description: '', intake_weight_g: '', intake_stone_carat: '', intake_stone_pcs: '' }))
      return
    }

    const inv = item.inventory_items
    setForm(prev => ({
      ...prev,
      inventory_item_id: inventoryItemId,
      item_description: `${item.item_description} (${inv.inventory_tag})`,
      intake_weight_g: inv.net_metal_weight_g?.toString() || '',
      intake_stone_carat: inv.stone_carat_total?.toString() || '',
      intake_stone_pcs: inv.stone_pcs_total?.toString() || ''
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_id) return toast.error('Select a customer')
    if (!form.item_description) return toast.error('Enter item description')
    if (sourceType === 'in-house' && !form.inventory_item_id) return toast.error('Select the specific product being repaired')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      const { data: job, error } = await supabase
        .from('craftsman_jobs')
        .insert({
          job_type: 'repair',
          status: 'pending',
          customer_id: form.customer_id,
          inventory_item_id: sourceType === 'in-house' ? form.inventory_item_id : null,
          item_description: form.item_description,
          intake_weight_g: Number(form.intake_weight_g) || 0,
          intake_stone_carat: Number(form.intake_stone_carat) || 0,
          intake_stone_pcs: Number(form.intake_stone_pcs) || 0,
          making_charge_amount: Number(form.making_charge_amount) || 0,
          craftsman_cost_amount: Number(form.craftsman_cost_amount) || 0,
          due_date: form.due_date,
          created_by: user?.id,
        })
        .select('id')
        .single()

      if (error) throw error

      toast.success('Repair intake created')
      router.push(`/repairs/${job.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Repair Intake</h1>
        <p className="mt-1 text-sm text-slate-500">Log a customer's item for repair.</p>
      </div>

      {/* Source Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSourceType('in-house')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${sourceType === 'in-house' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Store className="h-4 w-4" /> Our Product
        </button>
        <button
          type="button"
          onClick={() => setSourceType('external')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${sourceType === 'external' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Gem className="h-4 w-4" /> External / Walk-in
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Customer <span className="text-red-500">*</span></Label>
            <select 
              required 
              value={form.customer_id} 
              onChange={e => setForm({ ...form, customer_id: e.target.value, inventory_item_id: '', item_description: '' })} 
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Select Customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          <div>
            <Label>Expected Delivery Date</Label>
            <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="mt-1" />
          </div>
        </div>

        {/* In-House Product Selection */}
        {sourceType === 'in-house' && form.customer_id && (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-4">
            <Label className="text-brand-900">Select Product from Purchase History</Label>
            <select
              required
              value={form.inventory_item_id}
              onChange={(e) => handleSelectItem(e.target.value)}
              className="mt-1 w-full rounded-md border border-brand-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Select Item —</option>
              {customerItems.map((item: any) => (
                <option key={item.id} value={item.inventory_item_id}>
                  {item.inventory_items?.inventory_tag} — {item.item_description} 
                  {item.inventory_items?.net_metal_weight_g ? ` (${Number(item.inventory_items.net_metal_weight_g).toFixed(2)}g)` : ''}
                </option>
              ))}
            </select>
            {customerItems.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">No past purchases found for this customer. You can switch to "External" to enter manually.</p>
            )}
            {form.inventory_item_id && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
                <Check className="h-4 w-4" /> Product specs auto-filled below.
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Item Description <span className="text-red-500">*</span></Label>
          <Input 
            required 
            value={form.item_description} 
            onChange={e => setForm({ ...form, item_description: e.target.value })} 
            placeholder="e.g. 22K Gold Chain - Broken clasp" 
            className="mt-1" 
          />
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
          <div>
            <Label>Intake Weight (g)</Label>
            <Input type="number" step="0.001" value={form.intake_weight_g} onChange={e => setForm({ ...form, intake_weight_g: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Intake Stones (pcs)</Label>
            <Input type="number" value={form.intake_stone_pcs} onChange={e => setForm({ ...form, intake_stone_pcs: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Intake Stones (ct)</Label>
            <Input type="number" step="0.001" value={form.intake_stone_carat} onChange={e => setForm({ ...form, intake_stone_carat: e.target.value })} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <Label>Customer Charge (Rs.)</Label>
            <Input type="number" value={form.making_charge_amount} onChange={e => setForm({ ...form, making_charge_amount: e.target.value })} className="mt-1" placeholder="What customer pays" />
          </div>
          <div>
            <Label>Craftsman Cost (Rs.)</Label>
            <Input type="number" value={form.craftsman_cost_amount} onChange={e => setForm({ ...form, craftsman_cost_amount: e.target.value })} className="mt-1" placeholder="What you pay karigar" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-800">
        {saving ? 'Saving...' : 'Create Intake'}
      </Button>
    </form>
  )
}