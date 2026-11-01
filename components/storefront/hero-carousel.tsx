'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type HeroSlide = {
  id: string
  title: string
  subtitle: string | null
  image_url: string
  cta_label: string | null
  cta_href: string | null
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const t = setTimeout(() => setIdx((i) => (i + 1) % slides.length), 6000)
    return () => clearTimeout(t)
  }, [idx, paused, slides.length])

  if (slides.length === 0) return null

  return (
    <section
      className="relative h-[70vh] min-h-[500px] max-h-[820px] w-full overflow-hidden bg-stone-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, i) => {
        const isActive = i === idx
        const wrapperClass = `absolute inset-0 transition-opacity duration-700 ${
          isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`

        const inner = (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${slide.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              role="img"
              aria-label={slide.title}
            />
            {/* Subtle bottom shading so the controls are visible on light banners */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />
          </>
        )

        // If the slide has a CTA link, the entire image becomes clickable
        if (slide.cta_href) {
          return (
            <Link
              key={slide.id}
              href={slide.cta_href}
              className={`${wrapperClass} group block`}
              aria-label={slide.cta_label ?? slide.title}
            >
              {inner}
            </Link>
          )
        }

        return (
          <div key={slide.id} className={wrapperClass}>
            {inner}
          </div>
        )
      })}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() =>
              setIdx((i) => (i - 1 + slides.length) % slides.length)
            }
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 backdrop-blur-sm transition-colors hover:bg-black/50"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % slides.length)}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 backdrop-blur-sm transition-colors hover:bg-black/50"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>

          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx
                    ? 'w-8 bg-white'
                    : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}