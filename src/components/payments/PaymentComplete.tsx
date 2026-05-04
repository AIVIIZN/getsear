'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { SPRING_SNAP, SPRING_SOFT, useReducedMotion } from '@/lib/motion/transitions'

interface PaymentCompleteProps {
  totalCents: number
  tipCents: number
  paymentMethod: string
  cardLastFour?: string
  changeDueCents?: number
  onDone: () => void
  autoRedirectMs?: number
}

export function PaymentComplete({
  totalCents,
  tipCents,
  paymentMethod,
  cardLastFour,
  changeDueCents,
  onDone,
  autoRedirectMs = 3000,
}: PaymentCompleteProps) {
  const reduced = useReducedMotion()
  const [showCheck, setShowCheck] = useState(false)
  const [countdown, setCountdown] = useState(Math.ceil(autoRedirectMs / 1000))

  // Animate checkmark in
  useEffect(() => {
    const timer = setTimeout(() => setShowCheck(true), reduced ? 0 : 150)
    return () => clearTimeout(timer)
  }, [reduced])

  // Auto-redirect countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onDone()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onDone, autoRedirectMs])

  const methodLabel =
    paymentMethod === 'credit_card' || paymentMethod === 'debit_card'
      ? `Card${cardLastFour ? ` ****${cardLastFour}` : ''}`
      : paymentMethod === 'cash'
        ? 'Cash'
        : paymentMethod === 'gift_card'
          ? 'Gift Card'
          : paymentMethod === 'apple_pay' || paymentMethod === 'google_pay'
            ? 'Digital Wallet'
            : 'Payment'

  return (
    <motion.div
      className="flex flex-col items-center gap-6 py-8"
      initial={reduced ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduced ? { duration: 0 } : SPRING_SNAP}
    >
      {/* Animated checkmark */}
      <motion.div
        className="flex size-24 items-center justify-center rounded-full bg-success/10"
        initial={reduced ? false : { scale: 0.4, opacity: 0 }}
        animate={showCheck ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: 'spring', stiffness: 400, damping: 18, mass: 0.7 }
        }
      >
        <motion.span
          initial={reduced ? false : { scale: 0, opacity: 0 }}
          animate={showCheck ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 20, mass: 0.6, delay: 0.12 }
          }
        >
          <Check className="size-12 text-success" strokeWidth={3} />
        </motion.span>
      </motion.div>

      <motion.h2
        className="text-2xl font-bold text-success"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={showCheck ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={reduced ? { duration: 0 } : { ...SPRING_SOFT, delay: 0.18 }}
      >
        Payment Complete
      </motion.h2>

      {/* Summary */}
      <motion.div
        className="w-full max-w-xs space-y-3 rounded-xl bg-secondary p-5"
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={showCheck ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={reduced ? { duration: 0 } : { ...SPRING_SOFT, delay: 0.28 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Method</span>
          <span className="text-sm font-semibold">{methodLabel}</span>
        </div>

        {tipCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tip</span>
            <MoneyDisplay cents={tipCents} className="text-sm font-semibold" />
          </div>
        )}

        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <MoneyDisplay cents={totalCents + tipCents} className="text-lg font-bold text-foreground" />
          </div>
        </div>

        {changeDueCents !== undefined && changeDueCents > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground">Change Due</span>
            <MoneyDisplay cents={changeDueCents} className="text-sm font-bold text-success" />
          </div>
        )}
      </motion.div>

      {/* Auto-redirect info */}
      <p className="text-sm text-muted-foreground">
        Returning to orders in {countdown}s...
      </p>

      <button
        onClick={onDone}
        className="btn-press touch-target-lg rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Done
      </button>
    </motion.div>
  )
}
