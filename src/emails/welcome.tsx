import * as React from 'react'
import { PrimaryButton, TransactionalLayout, type TransactionalEmailBrand, styles } from './_shared'

export interface WelcomeEmailProps extends TransactionalEmailBrand {
  ownerName?: string
  onboardingUrl?: string
}

export default function WelcomeEmail({
  ownerName = 'there',
  onboardingUrl = 'https://getsear.com/onboarding',
  ...brand
}: WelcomeEmailProps) {
  return (
    <TransactionalLayout
      preview="Your Sear POS workspace is ready."
      title="Welcome to Sear POS"
      {...brand}
    >
      <p style={styles.bodyText}>Hi {ownerName},</p>
      <p style={styles.bodyText}>
        Your restaurant workspace is ready. Finish setup to seed your menu, invite staff,
        connect terminals, and ring up the first order.
      </p>
      <PrimaryButton href={onboardingUrl} accentColor={brand.accentColor}>
        Finish setup
      </PrimaryButton>
    </TransactionalLayout>
  )
}
