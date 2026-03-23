'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TutorialTooltip } from './TutorialTooltip'
import {
  type TutorialDefinition,
  getTutorialForPage,
  isTutorialCompleted,
  markTutorialCompleted,
  resetTutorial,
} from './tutorials'

interface TutorialOverlayProps {
  pageId: string
  /** If true, auto-start on first visit. Default true */
  autoStart?: boolean
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

const SPOTLIGHT_PADDING = 8
const TOOLTIP_OFFSET = 16

/**
 * Tutorial overlay with spotlight effect.
 * Darkens everything except the target element.
 * Renders a positioned tooltip chain.
 *
 * Usage:
 * <TutorialOverlay pageId="pos-orders" />
 *
 * Target elements must have data-tutorial="..." attributes
 * matching the `target` selector in the tutorial definition.
 */
export function TutorialOverlay({ pageId, autoStart = true }: TutorialOverlayProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [tutorial, setTutorial] = useState<TutorialDefinition | null>(null)
  const [mounted, setMounted] = useState(false)
  const resizeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load tutorial definition and auto-start if needed
  useEffect(() => {
    const def = getTutorialForPage(pageId)
    setTutorial(def ?? null)

    if (def && autoStart && !isTutorialCompleted(pageId)) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setIsActive(true)
        setCurrentStep(0)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [pageId, autoStart])

  // Calculate target element position
  const updateTargetPosition = useCallback(() => {
    if (!tutorial || !isActive) return

    const step = tutorial.steps[currentStep]
    if (!step) return

    const el = document.querySelector(step.target)
    if (!el) {
      // Target not found — skip to next step or end
      if (currentStep < tutorial.steps.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        handleComplete()
      }
      return
    }

    const rect = el.getBoundingClientRect()
    setTargetRect({
      top: rect.top - SPOTLIGHT_PADDING,
      left: rect.left - SPOTLIGHT_PADDING,
      width: rect.width + SPOTLIGHT_PADDING * 2,
      height: rect.height + SPOTLIGHT_PADDING * 2,
    })

    // Calculate tooltip position based on placement
    const tooltipWidth = 280
    const tooltipHeight = 200 // Approximate height
    let top = 0
    let left = 0

    switch (step.placement) {
      case 'top':
        top = rect.top - tooltipHeight - TOOLTIP_OFFSET
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        break
      case 'bottom':
        top = rect.bottom + TOOLTIP_OFFSET
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        break
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2
        left = rect.left - tooltipWidth - TOOLTIP_OFFSET
        break
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2
        left = rect.right + TOOLTIP_OFFSET
        break
    }

    // Keep tooltip within viewport
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16))
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16))

    setTooltipPosition({ top, left })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial, currentStep, isActive])

  useEffect(() => {
    updateTargetPosition()

    const handleResize = () => {
      if (resizeRef.current) clearTimeout(resizeRef.current)
      resizeRef.current = setTimeout(updateTargetPosition, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', updateTargetPosition, true)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', updateTargetPosition, true)
      if (resizeRef.current) clearTimeout(resizeRef.current)
    }
  }, [updateTargetPosition])

  const handleNext = useCallback(() => {
    if (!tutorial) return
    if (currentStep < tutorial.steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleComplete()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial, currentStep])

  const handleComplete = useCallback(() => {
    markTutorialCompleted(pageId)
    setIsActive(false)
    setCurrentStep(0)
  }, [pageId])

  const handleSkip = useCallback(() => {
    handleComplete()
  }, [handleComplete])

  // Public API: replay tutorial
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.pageId === pageId) {
        resetTutorial(pageId)
        setCurrentStep(0)
        setIsActive(true)
      }
    }
    window.addEventListener('replay-tutorial' as string, handler as EventListener)
    return () => window.removeEventListener('replay-tutorial' as string, handler as EventListener)
  }, [pageId])

  if (!mounted || !isActive || !tutorial || !targetRect) return null

  const step = tutorial.steps[currentStep]
  if (!step) return null

  // Create the spotlight SVG mask
  const svgMask = (
    <svg
      className="fixed inset-0 z-[10000] h-full w-full"
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <mask id={`spotlight-mask-${pageId}`}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={targetRect.left}
            y={targetRect.top}
            width={targetRect.width}
            height={targetRect.height}
            rx="12"
            ry="12"
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.5)"
        mask={`url(#spotlight-mask-${pageId})`}
        style={{ pointerEvents: 'auto' }}
        onClick={handleSkip}
      />
    </svg>
  )

  return createPortal(
    <>
      {svgMask}
      <TutorialTooltip
        title={step.title}
        body={step.body}
        stepNumber={currentStep + 1}
        totalSteps={tutorial.steps.length}
        placement={step.placement}
        position={tooltipPosition}
        onNext={handleNext}
        onSkip={handleSkip}
        isLast={currentStep === tutorial.steps.length - 1}
      />
    </>,
    document.body
  )
}

/**
 * Dispatch a replay event for a tutorial.
 * Call this from a "Replay Tutorial" button.
 */
export function replayTutorial(pageId: string): void {
  window.dispatchEvent(
    new CustomEvent('replay-tutorial', { detail: { pageId } })
  )
}
