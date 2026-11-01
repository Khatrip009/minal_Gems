// lib/storefront/tax.ts

export const INDIA_GST_PERCENT = 3

// Any string that identifies the destination as India.
// Accepts the canonical name and ISO codes.
const INDIA_ALIASES = ['india', 'in', 'ind', 'bharat']

export function isGstApplicable(
  country: string | null | undefined,
): boolean {
  // No country info → assume India (default business case)
  if (!country) return true
  return INDIA_ALIASES.includes(country.trim().toLowerCase())
}

export type GstBreakdown = {
  applicable: boolean
  ratePercent: number
  amount: number
}

/**
 * Compute GST from a pre-tax subtotal.
 *
 * @param subtotal  Pre-tax amount in INR
 * @param country   Shipping country name or ISO code (null → India)
 */
export function calculateGst(
  subtotal: number,
  country: string | null | undefined,
): GstBreakdown {
  if (!isGstApplicable(country)) {
    return { applicable: false, ratePercent: 0, amount: 0 }
  }
  const amount = Math.round((subtotal * INDIA_GST_PERCENT) / 100)
  return {
    applicable: true,
    ratePercent: INDIA_GST_PERCENT,
    amount,
  }
}

export type CartPricing = {
  subtotal: number
  gst: GstBreakdown
  total: number
  shippingCountry: string
}

/**
 * Compute total cart pricing for a given shipping country.
 * Country is normalised: null / empty → 'India'.
 */
export function calculateCartPricing(
  subtotal: number,
  country: string | null | undefined,
): CartPricing {
  const resolvedCountry =
    country && country.trim() ? country.trim() : 'India'
  const gst = calculateGst(subtotal, resolvedCountry)
  return {
    subtotal,
    gst,
    total: subtotal + gst.amount,
    shippingCountry: resolvedCountry,
  }
}