import { z } from 'zod'

/** POST /api/auth/login */
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

/** POST /api/auth/pin-login */
export const pinLoginSchema = z.object({
  user_id: z.string().uuid('User ID must be a valid UUID'),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
})

/** POST /api/auth/verify-manager-pin */
export const verifyManagerPinSchema = z.object({
  user_id: z.string().uuid(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
  action: z.string().max(200).optional(),
})

/** POST /api/auth/forgot-password */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

/** POST /api/auth/reset-password */
export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

/** POST /api/auth/mfa/setup — enroll TOTP factor */
export const mfaSetupSchema = z.object({
  friendly_name: z.string().max(100).default('Authenticator App'),
})

/** POST /api/auth/mfa/verify — verify TOTP code */
export const mfaVerifySchema = z.object({
  factor_id: z.string().min(1),
  challenge_id: z.string().min(1),
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
})

/** POST /api/auth/mfa/recovery — use recovery code */
export const mfaRecoverySchema = z.object({
  recovery_code: z.string().min(1, 'Recovery code is required'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type PinLoginInput = z.infer<typeof pinLoginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type MfaSetupInput = z.infer<typeof mfaSetupSchema>
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>
export type MfaRecoveryInput = z.infer<typeof mfaRecoverySchema>
