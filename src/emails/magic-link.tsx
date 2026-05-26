import * as React from 'react'
import { PrimaryButton, TransactionalLayout, type TransactionalEmailBrand, styles } from './_shared'

export interface MagicLinkEmailProps extends TransactionalEmailBrand {
  loginUrl?: string
  expiresIn?: string
}

export default function MagicLinkEmail({
  loginUrl = 'https://getsear.com/login',
  expiresIn = '15 minutes',
  ...brand
}: MagicLinkEmailProps) {
  return (
    <TransactionalLayout preview="Use this secure link to sign in." title="Sign in to Sear POS" {...brand}>
      <p style={styles.bodyText}>
        Tap the button below to sign in. This link expires in {expiresIn}.
      </p>
      <PrimaryButton href={loginUrl} accentColor={brand.accentColor}>
        Sign in
      </PrimaryButton>
      <p style={styles.mutedText}>If you did not request this, you can ignore this email.</p>
    </TransactionalLayout>
  )
}
