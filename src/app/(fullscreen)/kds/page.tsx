'use client'

import dynamic from 'next/dynamic'
import React from 'react'

const KdsPageContent = dynamic(() => import('./KdsPageContent'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-zinc-900">
      <div className="text-zinc-400 text-lg">Loading KDS...</div>
    </div>
  ),
})

class KdsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-zinc-900 text-white">
          <h1 className="text-2xl font-bold mb-4">Kitchen Display System</h1>
          <p className="text-zinc-400 mb-6 text-center max-w-md">
            KDS is temporarily unavailable due to a rendering issue.
            <br />Please use the browser refresh button to retry.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
          >
            Reload KDS
          </button>
          <p className="text-zinc-600 text-xs mt-4">{this.state.error}</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function KdsPage() {
  return (
    <KdsErrorBoundary>
      <KdsPageContent />
    </KdsErrorBoundary>
  )
}
