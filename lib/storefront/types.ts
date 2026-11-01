export type StorefrontVariant = {
  id: string
  sku: string
  size_code: string | null
  metal_purity_code: string | null
  approx_metal_weight_g: number | null
  approx_stone_carat: number | null
  approx_stone_pcs: number | null
  default_price: number | null
  is_default: boolean
  available_items: StorefrontInventoryItem[]
}

export type StorefrontInventoryItem = {
  id: string
  inventory_tag: string
  floor_price: number
  net_metal_weight_g: number
  stone_carat_total: number
  stone_pcs_total: number
  metal_purity_code: string | null
}

export type StorefrontStone = {
  shape: string | null
  color: string | null
  clarity: string | null
  carat_each: number
  pcs: number
  cut: string | null
  category: string | null
  stone_master: {
    name: string | null
    category: string
    shape: string | null
    color: string | null
    clarity: string | null
  } | null
}

export type StorefrontImage = {
  url: string
  alt: string | null
  is_primary: boolean
  sort_order: number
}

export type StorefrontDesign = {
  id: string
  design_code: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  category_id: string | null
  category_name: string | null
  category_slug: string | null
  brand_name: string | null
  product_type: string
  fulfillment_type: 'in_stock' | 'made_to_order' | 'hybrid'
  default_purity_id: string | null
  default_purity_code: string | null
  meta_title: string | null
  meta_description: string | null

  images: StorefrontImage[]
  primary_image: string | null
  stones: StorefrontStone[]
  variants: StorefrontVariant[]

  // Derived
  in_stock_count: number
  min_price: number | null
  has_price: boolean
  available_inventory_item_ids: string[]
}

export type StorefrontCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  sort_order: number
  parent_id: string | null   // ← added
  children?: StorefrontCategory[]  // ← for nav dropdowns later
}

export type StorefrontPurity = {
  id: string
  code: string
  rate_per_gram: number
}

export type ShopFilters = {
  q?: string
  category?: string
  purity?: string
  min_price?: string
  max_price?: string
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc'
}