'use client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReferenceTable } from '@/components/reference-table'

type Opt = { value: string; label: string }

export function MetalTabs({ types, purities, rates, typeOptions, purityOptions }: {
  types: any[]; purities: any[]; rates: any[]; typeOptions: Opt[]; purityOptions: Opt[]
}) {
  return (
    <Tabs defaultValue="types" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Metal &amp; Purity</h1>
      </div>
      <TabsList>
        <TabsTrigger value="types">Metal types</TabsTrigger>
        <TabsTrigger value="purities">Purities</TabsTrigger>
        <TabsTrigger value="rates">Rates</TabsTrigger>
      </TabsList>

      <TabsContent value="types">
        <ReferenceTable
          title="Metal Types"
          singular="Metal type"
          table="metal_types"
          rows={types}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'symbol', label: 'Symbol' },
          ]}
          fields={[
            { name: 'code', label: 'Code', required: true, help: 'e.g. AU, AG' },
            { name: 'name', label: 'Name', required: true, help: 'e.g. Gold, Silver' },
            { name: 'symbol', label: 'Symbol', required: true, help: 'e.g. Au, Ag' },
          ]}
        />
      </TabsContent>

      <TabsContent value="purities">
        <ReferenceTable
          title="Metal Purities"
          singular="Purity"
          table="metal_purities"
          rows={purities}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'metal_type_name', label: 'Metal', format: (r) => (r as any).metal_types?.name ?? '—' },
            { key: 'purity_percent', label: '%', align: 'right' },
            { key: 'is_active', label: 'Active', format: (r) => r.is_active ? '✓' : '—' },
          ]}
          fields={[
            { name: 'metal_type_id', label: 'Metal type', type: 'select', required: true, options: typeOptions },
            { name: 'code', label: 'Code', required: true, help: 'e.g. 22K, 18K, 925' },
            { name: 'purity_percent', label: 'Purity %', type: 'number', step: '0.01', required: true, transform: Number },
            { name: 'is_active', label: 'Active', type: 'checkbox', default: true },
          ]}
        />
      </TabsContent>

      <TabsContent value="rates">
        <ReferenceTable
          title="Metal Rates"
          singular="Rate"
          table="metal_rates"
          rows={rates}
          canEdit={false}
          canDelete={false}
          columns={[
            { key: 'purity_code', label: 'Purity', format: (r) => (r as any).metal_purities?.code ?? '—' },
            { key: 'rate_per_gram', label: 'Rate / g', align: 'right', format: (r) => Number(r.rate_per_gram).toFixed(2) },
            { key: 'effective_from', label: 'Effective from', format: (r) => new Date(String(r.effective_from)).toLocaleString() },
            { key: 'source', label: 'Source' },
          ]}
          fields={[
            { name: 'purity_id', label: 'Purity', type: 'select', required: true, options: purityOptions },
            { name: 'rate_per_gram', label: 'Rate per gram', type: 'number', step: '0.01', required: true, transform: Number },
            { name: 'source', label: 'Source (optional)' },
          ]}
        />
        <p className="mt-2 text-xs text-slate-500">
          Rates are append-only. Adding a rate never modifies historical prices — always add a new one.
        </p>
      </TabsContent>
    </Tabs>
  )
}