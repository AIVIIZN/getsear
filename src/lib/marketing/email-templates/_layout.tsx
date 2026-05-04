/**
 * Shared layout/wrapper for marketing emails.
 * Mobile-first, inline-styled (react-email components emit inline styles).
 *
 * Used by `campaign.tsx`. Other marketing email templates (transactional
 * receipts, daily reports, etc.) should also wrap their bodies in
 * `<EmailLayout>` for visual consistency.
 */

import * as React from 'react'
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface EmailLayoutProps {
  /** Brief preview text shown in the inbox preview pane (after subject). */
  previewText?: string
  /** Restaurant / org name (rendered in header + footer). */
  orgName: string
  /** Optional logo URL — rendered in the header if present. */
  orgLogoUrl?: string | null
  /** Mailing address line shown above unsubscribe (CAN-SPAM). Optional. */
  mailingAddress?: string | null
  /** Absolute unsubscribe URL (built by caller). */
  unsubscribeUrl: string
  /** Body content. */
  children: React.ReactNode
}

const main: React.CSSProperties = {
  backgroundColor: '#f5f5f7',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  margin: 0,
  padding: 0,
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: 600,
  padding: 0,
  borderRadius: 8,
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  padding: '24px 32px',
  borderBottom: '1px solid #ececec',
  textAlign: 'center' as const,
}

const headerLogo: React.CSSProperties = {
  maxHeight: 48,
  margin: '0 auto',
}

const headerName: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: '#1d1d1f',
  letterSpacing: '-0.01em',
}

const content: React.CSSProperties = {
  padding: '32px',
  color: '#1d1d1f',
  fontSize: 16,
  lineHeight: 1.6,
}

const footer: React.CSSProperties = {
  padding: '24px 32px',
  textAlign: 'center' as const,
  color: '#86868b',
  fontSize: 12,
  lineHeight: 1.5,
}

const footerLink: React.CSSProperties = {
  color: '#86868b',
  textDecoration: 'underline',
}

export function EmailLayout({
  previewText,
  orgName,
  orgLogoUrl,
  mailingAddress,
  unsubscribeUrl,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="-apple-system"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={undefined}
          fontWeight={400}
          fontStyle="normal"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </Head>
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {orgLogoUrl ? (
              <Img src={orgLogoUrl} alt={orgName} style={headerLogo} />
            ) : (
              <Text style={headerName}>{orgName}</Text>
            )}
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={{ borderColor: '#ececec', margin: 0 }} />
          <Section style={footer}>
            {mailingAddress ? (
              <Text style={{ margin: '0 0 8px', color: '#86868b' }}>{mailingAddress}</Text>
            ) : null}
            <Text style={{ margin: '0 0 8px', color: '#86868b' }}>
              You&rsquo;re receiving this because you opted in at {orgName}.
            </Text>
            <Text style={{ margin: 0, color: '#86868b' }}>
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout
