'use client'

import type { Transition, Variants } from 'framer-motion'
import { useReducedMotion as fmUseReducedMotion } from 'framer-motion'

export const SPRING_SOFT: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 26,
  mass: 0.9,
}

export const SPRING_SNAP: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.7,
}

export const SPRING_BOUNCE: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 18,
  mass: 0.8,
}

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 28,
  mass: 1,
}

interface MotionPreset {
  initial: Record<string, number | string>
  animate: Record<string, number | string>
  exit?: Record<string, number | string>
  transition: Transition
}

export const fadeUp: MotionPreset = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: SPRING_SOFT,
}

export const fadeIn: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: SPRING_SOFT,
}

export const scaleIn: MotionPreset = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: SPRING_SNAP,
}

export const slideUp: MotionPreset = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
  transition: SPRING_SOFT,
}

export const itemSpawn: MotionPreset = {
  initial: { opacity: 0, scale: 0.92, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: -4 },
  transition: SPRING_BOUNCE,
}

export const checkmarkPop: MotionPreset = {
  initial: { opacity: 0, scale: 0.4 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.4 },
  transition: { type: 'spring', stiffness: 400, damping: 18, mass: 0.7 },
}

export const useReducedMotion = fmUseReducedMotion

export function respectMotion(transition: Transition, reduced: boolean): Transition {
  if (reduced) {
    return { duration: 0 }
  }
  return transition
}

export function withReducedMotion(
  preset: MotionPreset,
  reduced: boolean | null,
): {
  initial: MotionPreset['initial'] | false
  animate: MotionPreset['animate']
  exit?: MotionPreset['exit']
  transition: Transition
} {
  if (reduced) {
    return {
      initial: false,
      animate: preset.animate,
      exit: preset.exit,
      transition: { duration: 0 },
    }
  }
  return {
    initial: preset.initial,
    animate: preset.animate,
    exit: preset.exit,
    transition: preset.transition,
  }
}

export const spawnVariants: Variants = {
  initial: itemSpawn.initial,
  animate: itemSpawn.animate,
  exit: itemSpawn.exit ?? itemSpawn.initial,
}

export const fadeUpVariants: Variants = {
  initial: fadeUp.initial,
  animate: fadeUp.animate,
  exit: fadeUp.exit ?? fadeUp.initial,
}
