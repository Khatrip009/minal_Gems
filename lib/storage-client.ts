/**
 * Client for the minalgem-storage service (Express, port 4900 dev / api.minalgems.com prod).
 *
 * Backend routes (routes/storage.js):
 *   POST   /api/v1/upload   — multipart with `file` field, Bearer auth
 *   DELETE /api/v1/delete   — JSON body { url } or { filename }, Bearer auth
 */

import { createClient } from '@/lib/supabase/client'

const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL ?? 'http://localhost:4900'
const UPLOAD_PATH =
  process.env.NEXT_PUBLIC_STORAGE_UPLOAD_PATH ?? '/api/v1/upload'
const DELETE_PATH =
  process.env.NEXT_PUBLIC_STORAGE_DELETE_PATH ?? '/api/v1/delete'

type UploadResponse = {
  url?: string
  path?: string
  filename?: string
  error?: string
}

/**
 * Fetch the current Supabase access token from the browser session.
 * Returns null if the user is not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Upload a single image file. Returns the full public URL.
 */
export async function uploadImage(
  file: File,
  folder?: string,
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  if (folder) formData.append('folder', folder)

  const token = await getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${STORAGE_BASE}${UPLOAD_PATH}`, {
    method: 'POST',
    body: formData,
    headers,
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Upload failed (${res.status}) — server returned non-JSON response`,
    )
  }

  const data: UploadResponse = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Upload failed (${res.status})`)
  }

  const raw = data.url ?? data.path ?? data.filename
  if (!raw) {
    throw new Error(
      'Upload succeeded but server did not return url/path/filename',
    )
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw

  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`
  return `${STORAGE_BASE}${normalizedPath}`
}

/**
 * Delete an uploaded file via POST-style DELETE.
 * Best-effort — silently no-ops on failure. Orphans are cheap.
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Derive the relative path from the full URL if possible
  const base = STORAGE_BASE.replace(/\/$/, '')
  const relativePath = publicUrl.startsWith(base)
    ? publicUrl.slice(base.length)
    : publicUrl

  try {
    await fetch(`${STORAGE_BASE}${DELETE_PATH}`, {
      method: 'DELETE',
      headers,
      // Send both shapes — the controller likely reads one of them
      body: JSON.stringify({ url: publicUrl, path: relativePath }),
    })
  } catch {
    // Ignore — orphan cleanup is not critical
  }
}
/**
 * Resolve a stored asset path to an absolute URL the browser can load.
 *
 * Handles all three formats found in product_assets.url:
 *   1. Absolute:       https://api.example.com/products/x.png  → unchanged
 *   2. Root-relative:  /products/x.png                         → STORAGE_BASE + path
 *   3. Bare-relative:  products/x.png  (legacy rows)           → STORAGE_BASE + "/" + path
 *
 * Bare-relative is what your legacy data uses, so `<img src>` against it
 * currently resolves against the page URL and 404s. This normalizes it.
 */
export function resolveAssetUrl(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  const base = STORAGE_BASE.replace(/\/$/, '')
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`
}
/**
 * Inverse of resolveAssetUrl: strip the storage base so the DB stores a
 * portable relative path (matching your existing legacy rows).
 * URLs pointing at a *different* host (prod URLs saved from a dev box)
 * are preserved as-is — we don't rewrite what we don't own.
 */
export function toStoragePath(url: string): string {
  const base = STORAGE_BASE.replace(/\/$/, '')
  if (url.startsWith(base)) {
    return url.slice(base.length).replace(/^\//, '')
  }
  return url
}