'use client'

import { useState } from 'react'
import { Gem, Play } from 'lucide-react'
import { resolveAssetUrl } from '@/lib/storage-client'

type Asset = {
  id: string
  url: string
  alt_text: string | null
  asset_type: string
}

export function MediaGallery({
  assets,
  productName,
}: {
  assets: Asset[]
  productName: string
}) {
  const [activeId, setActiveId] = useState<string | null>(
    assets.length > 0 ? assets[0].id : null,
  )

  if (!assets || assets.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="flex aspect-square items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200">
              <Gem className="h-12 w-12 text-brand-500" strokeWidth={1.2} />
            </div>
            <p className="px-6 text-sm font-medium text-slate-600">
              {productName}
            </p>
            <p className="mt-1 text-xs text-slate-400">No media uploaded</p>
          </div>
        </div>
      </div>
    )
  }

  const activeAsset = assets.find((a) => a.id === activeId) || assets[0]
  const activeUrl = resolveAssetUrl(activeAsset.url)

  return (
    <div className="space-y-4">
      {/* Main Viewer */}
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        {activeAsset.asset_type === 'video' ? (
          <video
            src={activeUrl}
            controls
            autoPlay
            muted
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            src={activeUrl}
            alt={activeAsset.alt_text || productName}
            className="h-full w-full object-contain bg-white"
          />
        )}
      </div>

      {/* Thumbnail Strip */}
      {assets.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {assets.map((asset) => {
            const thumbUrl = resolveAssetUrl(asset.url)
            return (
              <button
                key={asset.id}
                onClick={() => setActiveId(asset.id)}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                  asset.id === activeAsset.id
                    ? 'border-brand-500 ring-2 ring-brand-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {asset.asset_type === 'video' ? (
                  <>
                    <video
                      src={thumbUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm">
                        <Play className="h-4 w-4 fill-white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={thumbUrl}
                    alt={asset.alt_text || 'Thumbnail'}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.3'
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}