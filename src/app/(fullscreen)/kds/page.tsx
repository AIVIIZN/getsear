'use client'

import dynamic from 'next/dynamic'

const KdsPageContent = dynamic(() => import('./KdsPageContent'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-zinc-900">
      <div className="text-zinc-400 text-lg">Loading KDS...</div>
    </div>
  ),
})

export default function KdsPage() {
  return <KdsPageContent />
}
