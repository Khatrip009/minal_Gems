export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20">
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-48 rounded bg-stone-200" />
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[4/5] rounded-lg bg-stone-200" />
              <div className="h-4 w-2/3 rounded bg-stone-200" />
              <div className="h-3 w-1/3 rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}