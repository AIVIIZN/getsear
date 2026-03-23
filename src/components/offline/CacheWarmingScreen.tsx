'use client'

import { useOfflineStore } from '@/stores/offline-store'

/**
 * Full-screen loading screen during initial cache warm.
 * Sear logo, animated progress ring, items loading listed.
 * Warm off-white background.
 */
export function CacheWarmingScreen() {
  const progress = useOfflineStore((s) => s.cacheWarmProgress)
  const stage = useOfflineStore((s) => s.cacheWarmStage)

  // SVG circle parameters
  const size = 96
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: '#FAF9F7' }}
    >
      {/* Logo */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #F06B18 0%, #E05A0D 100%)',
              boxShadow: '0 4px 12px rgba(240, 107, 24, 0.3)',
            }}
          >
            <span className="text-white text-[18px] font-bold">S</span>
          </div>
          <span className="text-[24px] font-bold text-[#1C1C1E] tracking-tight">
            Sear
          </span>
        </div>
      </div>

      {/* Progress ring */}
      <div className="relative mb-6">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(60, 60, 67, 0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F06B18"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(240, 107, 24, 0.3))',
            }}
          />
        </svg>
        {/* Percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20px] font-semibold text-[#1C1C1E] tabular-nums">
            {progress}%
          </span>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center max-w-sm px-4">
        <h2 className="text-[17px] font-semibold text-[#1C1C1E] mb-1">
          Preparing your station
        </h2>
        <p className="text-[14px] text-[#8E8E93] leading-relaxed min-h-[20px]">
          {stage || 'Initializing...'}
        </p>
      </div>

      {/* Subtle footer message */}
      <div className="absolute bottom-8 text-center">
        <p className="text-[12px] text-[#C7C7CC]">
          Caching data for offline use
        </p>
      </div>
    </div>
  )
}
