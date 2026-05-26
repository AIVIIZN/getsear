import * as React from 'react'
import { PrimaryButton, TransactionalLayout, type TransactionalEmailBrand, styles } from './_shared'

export interface PasswordResetEmailProps extends TransactionalEmailBrand {
  resetUrl?: string
  expiresIn?: string
}

export default function PasswordResetEmail({
  resetUrl = 'https://getsear.com/reset-password',
  expiresIn = '30 minutes',
  ...brand
}: PasswordResetEmailProps) {
  return (
    <TransactionalLayout preview="Reset your Sear POS password." title="Reset your password" {...brand}>
      <p style={styles.bodyText}>
        We received a request to reset your password. Use this secure link within {expiresIn}.
      </p>
      <PrimaryButton href={resetUrl} accentColor={brand.accentColor}>
        Reset password
      </PrimaryButton>
      <p style={styles.mutedText}>If this was not you, leave your password unchanged.</p>
    </TransactionalLayout>
  )
}
