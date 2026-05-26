import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface TransactionalEmailBrand {
  orgName?: string
  accentColor?: string
  appUrl?: string
}

interface TransactionalLayoutProps extends TransactionalEmailBrand {
  preview: string
  title: string
  children: React.ReactNode
}

export const defaultBrand: Required<TransactionalEmailBrand> = {
  orgName: 'Sear POS',
  accentColor: '#007aff',
  appUrl: 'https://getsear.com',
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function TransactionalLayout({
  preview,
  title,
  children,
  orgName = defaultBrand.orgName,
  accentColor = defaultBrand.accentColor,
  appUrl = defaultBrand.appUrl,
}: TransactionalLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ ...styles.header, borderTopColor: accentColor }}>
            <Text style={styles.brand}>{orgName}</Text>
            <Text style={styles.product}>Powered by Sear POS</Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {children}
          </Section>
          <Hr style={styles.rule} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Secure restaurant operations, payments, guests, and reporting.
            </Text>
            <Text style={styles.footerText}>
              <a href={appUrl} style={{ color: accentColor, textDecoration: 'none' }}>
                Open Sear POS
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function PrimaryButton({
  href,
  children,
  accentColor = defaultBrand.accentColor,
}: {
  href: string
  children: React.ReactNode
  accentColor?: string
}) {
  return (
    <Button href={href} style={{ ...styles.button, backgroundColor: accentColor }}>
      {children}
    </Button>
  )
}

export const styles: Record<string, React.CSSProperties> = {
  body: {
    margin: 0,
    backgroundColor: '#f5f5f7',
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  },
  container: {
    width: '100%',
    maxWidth: 600,
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    borderTop: '4px solid',
    padding: '24px 32px 18px',
  },
  brand: {
    margin: 0,
    color: '#1d1d1f',
    fontSize: 21,
    fontWeight: 700,
  },
  product: {
    margin: '4px 0 0',
    color: '#6e6e73',
    fontSize: 13,
  },
  content: {
    padding: '8px 32px 28px',
  },
  title: {
    margin: '0 0 18px',
    color: '#1d1d1f',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: '30px',
  },
  bodyText: {
    margin: '0 0 16px',
    color: '#1d1d1f',
    fontSize: 15,
    lineHeight: '24px',
  },
  mutedText: {
    margin: '0 0 12px',
    color: '#6e6e73',
    fontSize: 13,
    lineHeight: '20px',
  },
  panel: {
    margin: '18px 0',
    padding: 16,
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    margin: '0 0 8px',
    color: '#1d1d1f',
    fontSize: 14,
  },
  button: {
    borderRadius: 8,
    color: '#ffffff',
    display: 'inline-block',
    fontSize: 15,
    fontWeight: 700,
    padding: '12px 18px',
    textDecoration: 'none',
  },
  rule: {
    borderColor: '#e5e5ea',
    margin: 0,
  },
  footer: {
    padding: '20px 32px 28px',
  },
  footerText: {
    margin: '0 0 8px',
    color: '#6e6e73',
    fontSize: 12,
    lineHeight: '18px',
    textAlign: 'center',
  },
}
