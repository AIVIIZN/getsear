"use client"

import { AlertTriangle, KeyRound, RefreshCw, ShieldAlert, WifiOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui-v2/Button"

export interface ApiErrorBody {
  error?: string
  code?: string
  message?: string
  action?: string
}

export interface ErrorToastOptions {
  title?: string
  retry?: () => void
  managerHelp?: () => void
}

const FALLBACKS: Record<string, Required<Pick<ApiErrorBody, "message" | "action">>> = {
  NETWORK: {
    message: "Sear could not reach the server.",
    action: "Try again.",
  },
  UNAUTHORIZED: {
    message: "Your session has expired.",
    action: "Sign in again to continue.",
  },
  FORBIDDEN: {
    message: "You do not have permission to do that.",
    action: "Ask a manager to grant access.",
  },
  RATE_LIMITED: {
    message: "That action was tried too many times.",
    action: "Wait a moment, then try again.",
  },
  INTERNAL_ERROR: {
    message: "Something went wrong on Sear's side.",
    action: "Try again. If it still fails, contact support.",
  },
}

export function normalizeErrorForToast(error: unknown): Required<Pick<ApiErrorBody, "code" | "message" | "action">> {
  if (error instanceof TypeError) {
    return { code: "NETWORK", ...FALLBACKS.NETWORK }
  }

  if (typeof error === "object" && error !== null) {
    const body = error as ApiErrorBody
    const code = body.code ?? "INTERNAL_ERROR"
    const fallback = FALLBACKS[code] ?? FALLBACKS.INTERNAL_ERROR
    return {
      code,
      message: body.message ?? body.error ?? fallback.message,
      action: body.action ?? fallback.action,
    }
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message || FALLBACKS.INTERNAL_ERROR.message,
      action: FALLBACKS.INTERNAL_ERROR.action,
    }
  }

  return { code: "INTERNAL_ERROR", ...FALLBACKS.INTERNAL_ERROR }
}

export function showErrorToast(error: unknown, options: ErrorToastOptions = {}) {
  const normalized = normalizeErrorForToast(error)
  const Icon =
    normalized.code === "NETWORK"
      ? WifiOff
      : normalized.code === "UNAUTHORIZED"
        ? KeyRound
        : normalized.code === "FORBIDDEN"
          ? ShieldAlert
          : AlertTriangle

  toast.error(options.title ?? normalized.message, {
    description: normalized.action,
    icon: <Icon className="h-4 w-4" aria-hidden="true" />,
    action: options.retry
      ? {
          label: "Try again",
          onClick: options.retry,
        }
      : options.managerHelp
        ? {
            label: "Ask manager",
            onClick: options.managerHelp,
          }
        : undefined,
  })
}

export function ErrorToastAction({
  label = "Try again",
  onClick,
}: {
  label?: string
  onClick: () => void
}) {
  return (
    <Button size="sm" variant="secondary" leadingIcon={<RefreshCw aria-hidden="true" />} onClick={onClick}>
      {label}
    </Button>
  )
}
