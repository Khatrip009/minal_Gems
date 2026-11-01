// app/(auth)/layout.tsx
import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* …your existing branding panel… */}
      <div className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand mark so the panel isn't invisible on phones */}
          <div className="mb-8 flex items-center justify-center gap-3 md:hidden">
            <Image
              src="/logo_minalgems.png"
              alt="Minal Gems"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <span className="text-lg font-semibold tracking-tight">Minal Gems</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}