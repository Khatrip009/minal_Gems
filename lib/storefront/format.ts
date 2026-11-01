export function fmtINR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export function fmtWeight(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return '—'
  return `${g.toFixed(3)} g`
}