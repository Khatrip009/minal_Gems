// lib/catalog-constants.ts

export const PRODUCT_TYPES = [
  { value: 'jewellery',   label: 'Jewellery',    hint: 'Ring, chain, bangle, pendant — physical finished piece' },
  { value: 'loose_stone', label: 'Loose stone',  hint: 'Sold as a stone, no metal mounting' },
  { value: 'service',     label: 'Service',      hint: 'Repair, polishing, resizing — no physical item' },
] as const

export const FULFILLMENT_TYPES = [
  { value: 'in_stock',      label: 'In stock',      hint: 'Ready to sell now' },
  { value: 'made_to_order', label: 'Made to order', hint: 'Produced on order, delivered later' },
  { value: 'hybrid',        label: 'Hybrid',        hint: 'Sell from stock; reorder as needed' },
] as const

export const MAKING_CHARGE_TYPES = [
  { value: 'fixed',            label: 'Fixed ₹',    hint: 'Flat amount per piece' },
  { value: 'per_gram',         label: '₹ per gram', hint: 'Amount × net metal weight' },
  { value: 'percent_of_metal', label: '% of metal', hint: 'Percent × metal value' },
  { value: 'percent_of_total', label: '% of total', hint: 'Percent × (metal + stones)' },
] as const

// ── Stones ─────────────────────────────────────────────────────────────

export const STONE_CATEGORIES = [
  { value: 'diamond',   label: 'Diamond',   hint: 'Natural diamond' },
  { value: 'gemstone',  label: 'Gemstone',  hint: 'Ruby, emerald, sapphire…' },
  { value: 'lab_grown', label: 'Lab-grown', hint: 'CVD / HPHT' },
  { value: 'synthetic', label: 'Synthetic', hint: 'CZ, moissanite…' },
  { value: 'other',     label: 'Other',     hint: 'Pearl, coral, etc.' },
] as const

export const STONE_SHAPES = [
  'Round', 'Princess', 'Cushion', 'Emerald', 'Oval', 'Pear',
  'Marquise', 'Radiant', 'Asscher', 'Heart', 'Trillion',
  'Baguette', 'Cabochon', 'Bead', 'Free-form',
] as const

export const STONE_COLORS = [
  'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'White', 'Yellow', 'Pink', 'Blue', 'Green', 'Red', 'Brown', 'Black',
  'Colorless',
] as const

export const STONE_CLARITY = [
  'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3',
  'Eye-clean', 'Included', 'Opaque',
] as const

export const STONE_CUTS = [
  'Excellent', 'Very Good', 'Good', 'Fair', 'Poor',
] as const

export const FLUORESCENCE_GRADES = [
  'None', 'Faint', 'Medium', 'Strong', 'Very Strong',
] as const

// ── Materials ──────────────────────────────────────────────────────────

export const MATERIAL_CATEGORIES = [
  'leather', 'thread', 'cord', 'clasp', 'finding',
  'packaging', 'consumable', 'tool', 'other',
] as const

export const MATERIAL_UNITS = [
  'piece', 'gram', 'meter', 'centimeter', 'carat', 'ml', 'roll', 'sheet', 'set',
] as const