'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ExternalLink,
  Upload,
  X,
  Loader2,
  Link as LinkIcon,
} from 'lucide-react'

type Slide = {
  id: string
  title: string
  subtitle: string | null
  image_url: string
  cta_label: string | null
  cta_href: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type FormData = {
  title: string
  subtitle: string
  image_url: string
  cta_label: string
  cta_href: string
  sort_order: string
  is_active: boolean
}

const BUCKET = 'hero-slides'
const MAX_SIZE_MB = 5

const emptyForm: FormData = {
  title: '',
  subtitle: '',
  image_url: '',
  cta_label: '',
  cta_href: '',
  sort_order: '0',
  is_active: true,
}

/** Extract the storage path from a public URL.
 *  e.g. https://xxx.supabase.co/storage/v1/object/public/hero-slides/abc.jpg → "abc.jpg"
 */
function extractStoragePath(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length))
}

function uniqueName(originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  const base =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${base}.${ext}`
}

export function HeroSlidesClient({ initialSlides }: { initialSlides: Slide[] }) {
  const router = useRouter()
  const [slides, setSlides] = useState(initialSlides)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Slide | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload')
  const [form, setForm] = useState<FormData>(emptyForm)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setEditing(null)
    setImageMode('upload')
    setForm({
      ...emptyForm,
      sort_order: String(
        slides.length > 0
          ? Math.max(...slides.map((s) => s.sort_order)) + 1
          : 0,
      ),
    })
    setDialogOpen(true)
  }

  function openEdit(s: Slide) {
    setEditing(s)
    setImageMode('url') // existing slide already has a URL
    setForm({
      title: s.title,
      subtitle: s.subtitle ?? '',
      image_url: s.image_url,
      cta_label: s.cta_label ?? '',
      cta_href: s.cta_href ?? '',
      sort_order: String(s.sort_order),
      is_active: s.is_active,
    })
    setDialogOpen(true)
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, WebP, AVIF)')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image too large — max ${MAX_SIZE_MB} MB`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const name = uniqueName(file.name)

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(name, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(name)
      setForm((f) => ({ ...f, image_url: pub.publicUrl }))
      toast.success('Image uploaded')
    } catch (err: any) {
      console.error('[hero-slides] upload failed:', err)
      toast.error(err?.message ?? 'Upload failed', { duration: 10000 })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function clearImage() {
    const oldUrl = form.image_url
    setForm((f) => ({ ...f, image_url: '' }))

    // If the old image was in our bucket, delete it from storage
    const path = extractStoragePath(oldUrl)
    if (path) {
      const supabase = createClient()
      await supabase.storage.from(BUCKET).remove([path])
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    if (!form.image_url.trim()) return toast.error('Add an image first')

    setSaving(true)
    const supabase = createClient()
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      image_url: form.image_url.trim(),
      cta_label: form.cta_label.trim() || null,
      cta_href: form.cta_href.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    }

    if (editing) {
      // If the image URL changed and the old one was in our bucket, delete it
      if (editing.image_url !== payload.image_url) {
        const oldPath = extractStoragePath(editing.image_url)
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath])
        }
      }

      const { data, error } = await supabase
        .from('hero_slides')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single()
      setSaving(false)
      if (error) return toast.error(error.message, { duration: 10000 })
      setSlides((prev) =>
        prev.map((s) => (s.id === editing.id ? (data as Slide) : s)),
      )
      toast.success('Slide updated')
    } else {
      const { data, error } = await supabase
        .from('hero_slides')
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (error) {
        // Roll back the just-uploaded file so we don't leave orphans
        const path = extractStoragePath(payload.image_url)
        if (path) await supabase.storage.from(BUCKET).remove([path])
        return toast.error(error.message, { duration: 10000 })
      }
      setSlides((prev) =>
        [...prev, data as Slide].sort((a, b) => a.sort_order - b.sort_order),
      )
      toast.success('Slide created')
    }
    setDialogOpen(false)
    router.refresh()
  }

  async function toggleActive(s: Slide) {
    const supabase = createClient()
    const { error } = await supabase
      .from('hero_slides')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
    if (error) return toast.error(error.message)
    setSlides((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)),
    )
    toast.success(s.is_active ? 'Slide hidden' : 'Slide shown')
    router.refresh()
  }

  async function move(s: Slide, dir: -1 | 1) {
    const sorted = [...slides].sort((a, b) => a.sort_order - b.sort_order)
    const i = sorted.findIndex((x) => x.id === s.id)
    if (i < 0) return
    const swapWith = i + dir
    if (swapWith < 0 || swapWith >= sorted.length) return
    const a = sorted[i]
    const b = sorted[swapWith]
    const supabase = createClient()
    await Promise.all([
      supabase.from('hero_slides').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('hero_slides').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    setSlides((prev) =>
      prev
        .map((x) => {
          if (x.id === a.id) return { ...x, sort_order: b.sort_order }
          if (x.id === b.id) return { ...x, sort_order: a.sort_order }
          return x
        })
        .sort((x, y) => x.sort_order - y.sort_order),
    )
    router.refresh()
  }

  async function remove(s: Slide) {
    if (
      !confirm(
        `Delete "${s.title}"?\n\nThe image file will also be removed from storage.`,
      )
    )
      return
    const supabase = createClient()

    // Delete DB row first
    const { error } = await supabase.from('hero_slides').delete().eq('id', s.id)
    if (error) return toast.error(error.message)

    // Then delete the storage object if it's ours
    const path = extractStoragePath(s.image_url)
    if (path) {
      await supabase.storage.from(BUCKET).remove([path])
    }

    setSlides((prev) => prev.filter((x) => x.id !== s.id))
    toast.success('Slide and image deleted')
    router.refresh()
  }

  const sorted = [...slides].sort((a, b) => a.sort_order - b.sort_order)
  const activeCount = sorted.filter((s) => s.is_active).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hero Slides"
        description={`${activeCount} active · ${sorted.length} total · shown on the storefront homepage`}
        actions={
          <div className="flex gap-2">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Preview site
            </Link>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Add slide
            </Button>
          </div>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-5 w-5" />}
          title="No hero slides yet"
          description="Add your first slide to start promoting on the storefront homepage."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add slide
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Preview
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Title
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  CTA
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Order
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-slate-600">
                  Active
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                    !s.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="h-16 w-24 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {s.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image_url}
                          alt={s.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-900">{s.title}</p>
                    {s.subtitle && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {s.subtitle}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {s.cta_label ? (
                      <div>
                        <p className="font-medium text-slate-800">
                          {s.cta_label}
                        </p>
                        {s.cta_href && (
                          <p className="font-mono text-[10px] text-slate-500">
                            → {s.cta_href}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular">
                    <div className="inline-flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(s, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-slate-600">
                        {s.sort_order}
                      </span>
                      <button
                        type="button"
                        onClick={() => move(s, 1)}
                        disabled={i === sorted.length - 1}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleActive(s)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        s.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200'
                      }`}
                    >
                      {s.is_active ? (
                        <>
                          <Eye className="h-3 w-3" /> Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" /> Hidden
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                        aria-label="Edit slide"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive-ghost"
                        size="sm"
                        onClick={() => remove(s)}
                        aria-label="Delete slide"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Slides appear on the storefront homepage as a full-bleed image carousel.
        Upload a designed advertisement image (text, products, branding all baked
        in). Clicking the image navigates to the CTA link if set. Max{' '}
        {MAX_SIZE_MB} MB per image.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit slide' : 'New hero slide'}</DialogTitle>
            <DialogDescription>
              Content shown on the storefront homepage carousel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2">
            {/* ── Image ────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label>
                Image <span className="text-red-500">*</span>
              </Label>

              {/* Preview */}
              {form.image_url ? (
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image_url}
                    alt="Preview"
                    className="h-48 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-1 text-xs text-slate-500">
                      No image selected
                    </p>
                  </div>
                </div>
              )}

              {/* Mode toggle */}
              <div className="flex gap-1 rounded-md bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                    imageMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="mr-1 inline h-3 w-3" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                    imageMode === 'url'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LinkIcon className="mr-1 inline h-3 w-3" />
                  Paste URL
                </button>
              </div>

              {/* Input based on mode */}
              {imageMode === 'upload' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFile(f)
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {form.image_url ? 'Replace image' : 'Choose image'}
                      </>
                    )}
                  </Button>
                  <p className="mt-1 text-[10px] text-slate-500">
                    JPG, PNG, WebP or AVIF · max {MAX_SIZE_MB} MB
                  </p>
                </div>
              ) : (
                <Input
                  type="url"
                  value={form.image_url}
                  onChange={(e) =>
                    setForm({ ...form, image_url: e.target.value })
                  }
                  placeholder="https://…/hero.jpg or /hero/slide-1.jpg"
                />
              )}
            </div>

            {/* ── Text fields ─────────────────────────────────────── */}
            <div className="space-y-1">
              <Label>
                Internal title <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Bridal Collection — October 2026"
              />
              <p className="text-[10px] text-slate-500">
                Used only in admin lists and as alt text — not shown on the
                storefront.
              </p>
            </div>

            <div className="space-y-1">
              <Label>Internal subtitle</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Optional note for your team"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>CTA label</Label>
                <Input
                  value={form.cta_label}
                  onChange={(e) =>
                    setForm({ ...form, cta_label: e.target.value })
                  }
                  placeholder="Explore the collection"
                />
                <p className="text-[10px] text-slate-500">
                  Visible to assistive tech only.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Click destination</Label>
                <Input
                  value={form.cta_href}
                  onChange={(e) =>
                    setForm({ ...form, cta_href: e.target.value })
                  }
                  placeholder="/shop/bridal"
                />
                <p className="text-[10px] text-slate-500">
                  Where clicking the image goes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: e.target.value })
                  }
                />
                <p className="text-[10px] text-slate-500">
                  Lower numbers appear first.
                </p>
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Show on storefront
                </label>
              </div>
            </div>

            <DialogFooter className="!mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}