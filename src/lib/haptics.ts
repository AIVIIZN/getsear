// NOTE: iOS Safari (iPad / iPhone) does NOT implement the Vibration API.
// `navigator.vibrate` is undefined there, so this module gracefully no-ops.
// Native iOS UIImpactFeedbackGenerator is only reachable from native code or
// a Capacitor/WebKit wrapper — there is no web bridge from a regular browser
// tab in 2026. Android Chrome and most desktop browsers DO support
// navigator.vibrate; those will buzz on Android tablets.
// If/when Sear ships a native iOS shell, add the JS bridge here.

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  warning: [20, 60, 20],
  error: [40, 80, 40],
}

export function haptic(pattern: HapticPattern = 'light'): void {
  if (typeof window === 'undefined') return
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch (err) {
    console.error('[haptics]', err)
  }
}

export const haptics = {
  orderAdd: () => haptic('light'),
  paymentSuccess: () => haptic('success'),
  kdsBump: () => haptic('medium'),
  managerApprove: () => haptic('heavy'),
  warning: () => haptic('warning'),
  error: () => haptic('error'),
}
