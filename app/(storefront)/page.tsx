import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HeroCarousel, type HeroSlide } from '@/components/storefront/hero-carousel'
import {
  ArrowRight,
  Sparkles,
  Shield,
  Truck,
  RotateCcw,
  Award,
  Star,
  Gem,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Minal Gems'

type CategoryCard = {
  name: string
  slug: string | null
  count: number
  image_url?: string | null
}

type FeaturedPiece = {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image: string | null
  inventory_tag: string
}

export default async function StorefrontHomePage() {
  let slides: HeroSlide[] = []
  let featured: FeaturedPiece[] = []
  let categories: CategoryCard[] = []

  try {
    const supabase = await createClient()

    const [heroRes, featuredRes, catRes] = await Promise.all([
      supabase
        .from('hero_slides')
        .select('id, title, subtitle, image_url, cta_label, cta_href')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('inventory_items')
        .select(
          `
          id, inventory_tag, floor_price,
          product_variants (
            id, website_enabled,
            product_designs (
              id, name, short_description,
              categories ( name, slug ),
              product_assets ( url, is_primary, sort_order )
            )
          )
        `,
        )
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('sort_order')
        .limit(10),
    ])

    if (heroRes.error) {
      console.error('[storefront/home] hero_slides query failed:', heroRes.error)
    } else {
      slides = (heroRes.data ?? []) as HeroSlide[]
    }

    if (catRes.data) {
      categories = catRes.data.map((c: any) => ({
        name: c.name,
        slug: c.slug ?? null,
        count: 0,
        image_url: c.image_url ? resolveAssetUrlSafe(c.image_url) : null,
      }))
    }

    if (featuredRes.data) {
      featured = featuredRes.data
        .map((row: any) => {
          const design = row.product_variants?.product_designs
          if (!design) return null
          const assets = (design.product_assets ?? []) as any[]
          const primary =
            assets.find((a) => a.is_primary) ??
            assets.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
          return {
            id: row.id,
            name: design.name ?? 'Signature piece',
            description: design.short_description ?? null,
            price: row.floor_price != null ? Number(row.floor_price) : null,
            category: design.categories?.name ?? null,
            image: primary?.url ? resolveAssetUrlSafe(primary.url) : null,
            inventory_tag: row.inventory_tag,
          }
        })
        .filter((x): x is FeaturedPiece => x !== null)
        .filter((p, i, arr) => arr.findIndex((q) => q.name === p.name) === i)
        .slice(0, 8)
    }
  } catch (err) {
    console.error('[storefront/home] data load failed (page still renders):', err)
  }

  // Fallback hero slide
  if (slides.length === 0) {
    slides = [
      {
        id: 'fallback',
        title: 'Jewellery that outlives the moment',
        subtitle: null,
        image_url: '/hero/default.jpg',
        cta_label: 'Explore the collection',
        cta_href: '/shop',
      },
    ]
  }

  // Fallback categories
  const displayCategories: CategoryCard[] =
    categories.length > 0
      ? categories
      : [
          { name: 'Rings', slug: 'rings', count: 0, image_url: null },
          { name: 'Earrings', slug: 'earrings', count: 0, image_url: null },
          { name: 'Pendants', slug: 'pendants', count: 0, image_url: null },
          { name: 'Bangles', slug: 'bangles', count: 0, image_url: null },
          { name: 'Necklaces', slug: 'necklaces', count: 0, image_url: null },
          { name: 'Bracelets', slug: 'bracelets', count: 0, image_url: null },
        ]

  // Marquee only if 3+ categories (below that, static row)
  const useMarquee = displayCategories.length >= 3
  // Duplicate the list so the loop is seamless
  const marqueeCategories = useMarquee
    ? [...displayCategories, ...displayCategories]
    : displayCategories

  return (
    <div className="bg-stone-50">
      {/* ═══════════ HERO ═══════════ */}
      <HeroCarousel slides={slides} />

      {/* ═══════════ TRUST BAR ═══════════ */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 sm:grid-cols-4 sm:px-6">
          <TrustItem
            icon={<Shield className="h-4 w-4" />}
            title="BIS Hallmarked"
            sub="916 / 750 certified"
          />
          <TrustItem
            icon={<Award className="h-4 w-4" />}
            title="Certified Diamonds"
            sub="GIA / IGI every stone"
          />
          <TrustItem
            icon={<Truck className="h-4 w-4" />}
            title="Insured Delivery"
            sub="Free above ₹50,000"
          />
          <TrustItem
            icon={<RotateCcw className="h-4 w-4" />}
            title="Lifetime Exchange"
            sub="100% fair value"
          />
        </div>
      </section>

      {/* ═══════════ SHOP BY CATEGORY — auto-scrolling marquee ═══════════ */}
      <section className="overflow-hidden bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                The collections
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium text-stone-900 sm:text-4xl">
                Shop by category
              </h2>
            </div>
            <Link
              href="/shop"
              className="hidden shrink-0 items-center gap-1 text-sm font-medium text-stone-700 hover:text-stone-900 sm:flex"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Marquee wrapper — full bleed, outside the max-w container */}
        <div className="relative mt-8">
          {/* Edge fade (only when marquee) */}
          {useMarquee && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-24" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-24" />
            </>
          )}

          <div className={useMarquee ? 'overflow-hidden' : 'overflow-x-auto'}>
            <div
              className={
                useMarquee
                  ? 'flex gap-4 animate-categories-marquee w-max'
                  : 'flex gap-4 px-4 sm:px-6'
              }
            >
              {marqueeCategories.map((cat, i) => {
                const palettes = [
                  'from-amber-50 to-stone-100',
                  'from-rose-50 to-stone-100',
                  'from-stone-100 to-amber-50',
                  'from-stone-100 to-rose-50',
                  'from-amber-50 to-rose-50',
                  'from-stone-200 to-stone-100',
                ]
                const palette = palettes[i % palettes.length]
                const href = cat.slug ? `/shop/${cat.slug}` : '/shop'

                return (
                  <Link
                    key={`${cat.name}-${i}`}
                    href={href}
                    className="group relative aspect-[4/5] w-[180px] shrink-0 overflow-hidden rounded-xl border border-stone-200 transition-all hover:border-amber-300 hover:shadow-lg sm:w-[220px] lg:w-[240px]"
                  >
                    {/* Image or gradient background */}
                    {cat.image_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
                      </>
                    ) : (
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${palette}`}
                      />
                    )}

                    {/* Overlay content */}
                    <div className="relative flex h-full flex-col justify-between p-4">
                      <Gem
                        className={`h-5 w-5 ${
                          cat.image_url ? 'text-white/70' : 'text-stone-400/60'
                        }`}
                      />
                      <div>
                        <p
                          className={`font-serif text-base font-medium ${
                            cat.image_url ? 'text-white' : 'text-stone-900'
                          } group-hover:${cat.image_url ? 'text-white' : 'text-amber-800'}`}
                        >
                          {cat.name}
                        </p>
                        <p
                          className={`mt-0.5 text-[10px] ${
                            cat.image_url ? 'text-white/80' : 'text-stone-500'
                          }`}
                        >
                          Explore →
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Marquee animation + reduced-motion fallback */}
        {useMarquee && (
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @keyframes categories-marquee {
                  from { transform: translateX(0); }
                  to   { transform: translateX(-50%); }
                }
                .animate-categories-marquee {
                  animation: categories-marquee 45s linear infinite;
                }
                .animate-categories-marquee:hover {
                  animation-play-state: paused;
                }
                @media (prefers-reduced-motion: reduce) {
                  .animate-categories-marquee {
                    animation: none;
                  }
                }
              `,
            }}
          />
        )}
      </section>

      {/* ═══════════ FEATURED PIECES ═══════════ */}
      <section className="border-t border-stone-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                New arrivals
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium text-stone-900 sm:text-4xl">
                {featured.length > 0 ? 'Recently crafted' : 'The signature edit'}
              </h2>
            </div>
            <Link
              href="/shop"
              className="hidden shrink-0 items-center gap-1 text-sm font-medium text-stone-700 hover:text-stone-900 sm:flex"
            >
              Browse all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => (
                <Link
                  key={p.id}
                  href={`/shop?tag=${p.inventory_tag}`}
                  className="group"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-br from-stone-100 to-amber-50">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Gem className="h-12 w-12 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    {p.category && (
                      <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
                        {p.category}
                      </p>
                    )}
                    <p className="mt-0.5 font-serif text-base font-medium text-stone-900 group-hover:text-amber-800">
                      {p.name}
                    </p>
                    {p.price != null && p.price > 0 && (
                      <p className="mt-1 text-sm tabular text-stone-600">
                        ₹{' '}
                        {p.price.toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {[
                'The Solitaire Edit',
                'Everyday Gold',
                'Heirloom Bands',
                'Bridal Collection',
              ].map((label, i) => (
                <div key={label} className="group">
                  <div
                    className={`relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-br ${
                      [
                        'from-amber-100 to-stone-100',
                        'from-stone-100 to-rose-50',
                        'from-rose-50 to-amber-50',
                        'from-stone-200 to-amber-100',
                      ][i]
                    }`}
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <Gem className="h-12 w-12 text-stone-300" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
                      Coming soon
                    </p>
                    <p className="mt-0.5 font-serif text-base font-medium text-stone-900">
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ CRAFT STORY — real image ═══════════ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/process-hero4.jpg"
                alt="At the bench — hand-setting stones in the Minal Gems workshop"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stone-900/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="font-serif text-lg font-medium text-white drop-shadow">
                  At the bench
                </p>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 hidden w-48 rounded-xl border border-stone-200 bg-white p-4 shadow-lg sm:block">
              <p className="font-serif text-3xl font-medium text-stone-900">
                25+
              </p>
              <p className="text-xs uppercase tracking-wider text-stone-500">
                Years of craftsmanship
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              The making
            </p>
            <h2 className="mt-2 font-serif text-3xl font-medium leading-tight text-stone-900 sm:text-4xl">
              Every piece begins
              <br />
              with a conversation.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-stone-600">
              We design with you, not for you. A sketch becomes a wax model,
              becomes a casting, becomes a piece you hold in your hand — the
              whole arc of the making, in our workshop in Surat.
            </p>
            <p className="mt-3 text-base leading-relaxed text-stone-600">
              Every diamond is certified. Every gram of gold is hallmarked. Every
              finish is inspected by hand before it leaves us.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <Stat number="25+" label="Years of craft" />
              <Stat number="5k+" label="Pieces made" />
              <Stat number="100%" label="Certified" />
            </div>
            <Link
              href="/shop"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-stone-900 hover:text-amber-800"
            >
              See the collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="border-t border-stone-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Worn with love
            </p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-stone-900 sm:text-4xl">
              From our clients
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                quote:
                  'The necklace arrived beautifully packaged, and the craftsmanship is extraordinary. It feels like an heirloom already.',
                name: 'Priya S.',
                role: 'Bridal collection',
              },
              {
                quote:
                  'The team walked me through every certification, every carat weight. I have never felt more confident buying jewellery.',
                name: 'Anjali M.',
                role: 'Solitaire ring',
              },
              {
                quote:
                  'A gift for my mother. Twenty years of wearing it, and it still looks new. That says everything.',
                name: 'Rahul D.',
                role: 'Heritage bangle',
              },
            ].map((t, i) => (
              <div
                key={i}
                className="rounded-2xl border border-stone-200 bg-stone-50/60 p-6"
              >
                <div className="flex items-center gap-1 text-amber-500">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <Star key={n} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 font-serif text-base italic leading-relaxed text-stone-700">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3 border-t border-stone-200 pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-800">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {t.name}
                    </p>
                    <p className="text-[11px] text-stone-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 py-20">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-400 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-amber-600 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Gem className="mx-auto h-8 w-8 text-amber-300" />
          <h2 className="mt-4 font-serif text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
            Book a private viewing.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-200">
            Our design consultants will walk you through the collection in
            person or over a video call — at your pace, no pressure.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100"
            >
              Explore the collection <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-white/60 hover:bg-white/10"
            >
              Create an account
            </Link>
          </div>
          <p className="mt-6 text-xs uppercase tracking-widest text-amber-200">
            {COMPANY_NAME} · Est. 1998 · Surat, Gujarat
          </p>
        </div>
      </section>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────

function TrustItem({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-900">{title}</p>
        <p className="text-[11px] text-stone-500">{sub}</p>
      </div>
    </div>
  )
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-2xl font-medium text-stone-900">{number}</p>
      <p className="text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </p>
    </div>
  )
}

function resolveAssetUrlSafe(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return url
  try {
    const { resolveAssetUrl } = require('@/lib/storage-client')
    return resolveAssetUrl(url)
  } catch {
    return url
  }
}