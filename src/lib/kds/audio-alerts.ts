/**
 * KDS Escalating Audio Alert System
 *
 * Uses Web Audio API oscillators (no audio files needed).
 * Alert levels escalate in volume and urgency as tickets age.
 * All sounds are configurable and can be independently muted.
 */

type AlertLevel = 'fresh' | 'aging' | 'late' | 'critical'
type AlertType = 'new_ticket' | 'rush' | 'vip' | 'refire' | 'ready_to_run' | 'aging' | 'late' | 'critical'

interface KdsAudioState {
  audioContext: AudioContext | null
  isMuted: boolean
  volume: number // 0-1
  lastAlertTimes: Map<string, number> // ticketId -> last alert timestamp
  lastAlertLevels: Map<string, AlertLevel> // ticketId -> last level
}

const state: KdsAudioState = {
  audioContext: null,
  isMuted: false,
  volume: 0.5,
  lastAlertTimes: new Map(),
  lastAlertLevels: new Map(),
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!state.audioContext || state.audioContext.state === 'closed') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      state.audioContext = new AudioCtx()
    } catch {
      return null
    }
  }

  // Resume if suspended (browser autoplay policy)
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume().catch(() => {})
  }

  return state.audioContext
}

function playTone(
  frequency: number,
  duration: number,
  gain: number,
  startTime: number,
  ctx: AudioContext,
  type: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)

  osc.frequency.value = frequency
  osc.type = type

  const effectiveGain = gain * state.volume
  gainNode.gain.setValueAtTime(effectiveGain, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  osc.start(startTime)
  osc.stop(startTime + duration)
}

/** Single gentle chime - new ticket arrival */
export function playNewTicketSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(800, 0.15, 0.3, now, ctx)
}

/** Double beep for RUSH tickets */
export function playRushSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(800, 0.12, 0.4, now, ctx)
  playTone(1000, 0.12, 0.4, now + 0.15, ctx)
}

/** Triple ascending chime for VIP tickets */
export function playVipSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(600, 0.15, 0.35, now, ctx)
  playTone(800, 0.15, 0.35, now + 0.18, ctx)
  playTone(1000, 0.15, 0.35, now + 0.36, ctx)
}

/** Urgent rapid triple beep for RE-FIRE tickets */
export function playRefireSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(1200, 0.1, 0.6, now, ctx, 'square')
  playTone(1200, 0.1, 0.6, now + 0.12, ctx, 'square')
  playTone(1200, 0.1, 0.6, now + 0.24, ctx, 'square')
}

/** Pleasant ascending 3-note chime for "Ready to Run" */
export function playReadyToRunSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(523, 0.2, 0.3, now, ctx) // C5
  playTone(659, 0.2, 0.3, now + 0.22, ctx) // E5
  playTone(784, 0.3, 0.35, now + 0.44, ctx) // G5
}

/** Single gentle chime for aging tickets (every 60s) */
export function playAgingSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(400, 0.3, 0.25, now, ctx)
}

/** Louder double chime for late tickets (every 30s) */
export function playLateSound(): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  playTone(500, 0.2, 0.4, now, ctx)
  playTone(600, 0.2, 0.4, now + 0.25, ctx)
}

/** Urgent triple chime for critical tickets (every 15s) */
export function playCriticalSound(escalationLevel: number = 0): void {
  if (state.isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  // Volume escalates: 0.4 -> 0.55 -> 0.7
  const baseGain = Math.min(0.4 + escalationLevel * 0.15, 0.7)
  const now = ctx.currentTime

  playTone(800, 0.2, baseGain, now, ctx, 'sawtooth')
  playTone(1200, 0.2, baseGain, now + 0.22, ctx, 'sawtooth')
  playTone(800, 0.2, baseGain, now + 0.44, ctx, 'sawtooth')
}

/**
 * Check if an escalating alert should play for a ticket based on its aging level.
 * Prevents duplicate alerts and respects cooldown intervals.
 */
export function shouldPlayAgingAlert(
  ticketId: string,
  currentLevel: AlertLevel,
  previousLevel: AlertLevel | undefined
): boolean {
  // Only fire on live state transitions, not page reload
  if (previousLevel === undefined) return false
  if (currentLevel === previousLevel) {
    // Same level - check cooldown interval
    const lastTime = state.lastAlertTimes.get(ticketId) ?? 0
    const now = Date.now()

    const cooldowns: Record<AlertLevel, number> = {
      fresh: Infinity,
      aging: 60_000,  // 60 seconds
      late: 30_000,   // 30 seconds
      critical: 15_000, // 15 seconds
    }

    if (now - lastTime < cooldowns[currentLevel]) return false
    state.lastAlertTimes.set(ticketId, now)
    return currentLevel !== 'fresh'
  }

  // Level changed - play immediately
  state.lastAlertTimes.set(ticketId, Date.now())
  state.lastAlertLevels.set(ticketId, currentLevel)
  return currentLevel !== 'fresh'
}

/**
 * Play the appropriate sound for the given alert type.
 */
export function playAlertForType(alertType: AlertType, escalationLevel: number = 0): void {
  switch (alertType) {
    case 'new_ticket':
      playNewTicketSound()
      break
    case 'rush':
      playRushSound()
      break
    case 'vip':
      playVipSound()
      break
    case 'refire':
      playRefireSound()
      break
    case 'ready_to_run':
      playReadyToRunSound()
      break
    case 'aging':
      playAgingSound()
      break
    case 'late':
      playLateSound()
      break
    case 'critical':
      playCriticalSound(escalationLevel)
      break
  }
}

/**
 * Play the appropriate aging alert for a ticket if due.
 */
export function processTicketAgingAlert(
  ticketId: string,
  currentLevel: AlertLevel
): void {
  const previousLevel = state.lastAlertLevels.get(ticketId)
  if (shouldPlayAgingAlert(ticketId, currentLevel, previousLevel)) {
    playAlertForType(currentLevel as AlertType)
  }
  state.lastAlertLevels.set(ticketId, currentLevel)
}

/** Set global mute state */
export function setMuted(muted: boolean): void {
  state.isMuted = muted
}

/** Get mute state */
export function isMuted(): boolean {
  return state.isMuted
}

/** Set global volume (0-1) */
export function setVolume(volume: number): void {
  state.volume = Math.max(0, Math.min(1, volume))
}

/** Clean up tracking for a removed ticket */
export function removeTicketTracking(ticketId: string): void {
  state.lastAlertTimes.delete(ticketId)
  state.lastAlertLevels.delete(ticketId)
}

/** Reset all alert tracking (e.g., on station change) */
export function resetAlertTracking(): void {
  state.lastAlertTimes.clear()
  state.lastAlertLevels.clear()
}
