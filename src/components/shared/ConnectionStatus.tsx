'use client'

import { useOnlineStatus } from '@/hooks/use-online-status'

export function ConnectionStatus() {
  const isOnline = useOnlineStatus()

  return (
    <div className="flex items-center gap-2" title={isOnline ? 'Connected' : 'Offline'}>
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isOnline
            ? 'bg-[var(--success)]'
            : 'bg-[var(--error)] animate-pulse-attention'
        }`}
      />
      {!isOnline && (
        <span className="text-xs font-medium text-[var(--error)]">Offline</span>
      )}
    </div>
  )
}
