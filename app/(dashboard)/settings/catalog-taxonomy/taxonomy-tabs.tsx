'use client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReferenceTable } from '@/components/reference-table'

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Reusable transform: blank string → null
// Use for any UUID or numeric column that's optional
const blankToNull = (v: unknown) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

export function TaxonomyTabs({
  brands,
  categories,
}: {
  brands: any[]
  categories: any[]
}) {
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  return (
    <Tabs defaultValue="brands" className="space-y-4">
      <h1 className="text-2xl font-semibold">Catalog Taxonomy</h1>
      <TabsList>
        <TabsTrigger value="brands">Brands</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>

      <TabsContent value="brands">
        <ReferenceTable
          title="Brands"
          singular="Brand"
          table="brands"
          rows={brands}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'slug', label: 'Slug' },
            { key: 'description', label: 'Description' },
          ]}
          fields={[
            { name: 'name', label: 'Name', required: true },
            {
              name: 'slug',
              label: 'Slug',
              required: true,
              help: 'URL-safe identifier, must be unique',
              transform: (v) => slugify(String(v ?? '')),
            },
            { name: 'description', label: 'Description' },
            { name: 'logo_url', label: 'Logo URL' },
          ]}
        />
      </TabsContent>

      <TabsContent value="categories">
        <ReferenceTable
          title="Categories"
          singular="Category"
          table="categories"
          rows={categories}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'slug', label: 'Slug' },
            {
              key: 'parent_name',
              label: 'Parent',
              format: (r) =>
                categories.find((c) => c.id === r.parent_id)?.name ?? '—',
            },
            { key: 'sort_order', label: 'Order', align: 'right' },
            {
              key: 'is_active',
              label: 'Active',
              format: (r) => (r.is_active ? '✓' : '—'),
            },
          ]}
          fields={[
            { name: 'name', label: 'Name', required: true },
            {
              name: 'slug',
              label: 'Slug',
              required: true,
              help: 'URL-safe identifier, must be unique',
              transform: (v) => slugify(String(v ?? '')),
            },
            {
              name: 'parent_id',
              label: 'Parent (optional)',
              type: 'select',
              options: categoryOptions,
              transform: blankToNull,        // ← the actual fix for the 400
            },
            {
              name: 'sort_order',
              label: 'Sort order',
              type: 'number',
              default: 0,
              transform: (v) => Number(v) || 0,
            },
            {
              name: 'is_active',
              label: 'Active',
              type: 'checkbox',
              default: true,
            },
            { name: 'description', label: 'Description' },
          ]}
        />
      </TabsContent>
    </Tabs>
  )
}