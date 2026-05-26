import { render } from '@react-email/render'
import { Resend } from 'resend'
import WelcomeEmail, { type WelcomeEmailProps } from '@/emails/welcome'
import MagicLinkEmail, { type MagicLinkEmailProps } from '@/emails/magic-link'
import PasswordResetEmail, { type PasswordResetEmailProps } from '@/emails/password-reset'
import ReceiptEmail, { type ReceiptEmailProps } from '@/emails/receipt'
import StatementEmail, { type StatementEmailProps } from '@/emails/statement'
import WeeklySummaryEmail, { type WeeklySummaryEmailProps } from '@/emails/weekly-summary'

export type TransactionalEmailType =
  | 'welcome'
  | 'magic-link'
  | 'password-reset'
  | 'receipt'
  | 'statement'
  | 'weekly-summary'

type TemplateProps = {
  welcome: WelcomeEmailProps
  'magic-link': MagicLinkEmailProps
  'password-reset': PasswordResetEmailProps
  receipt: ReceiptEmailProps
  statement: StatementEmailProps
  'weekly-summary': WeeklySummaryEmailProps
}

export const transactionalEmailSubjects: Record<TransactionalEmailType, string> = {
  welcome: 'Welcome to Sear POS',
  'magic-link': 'Your Sear POS sign-in link',
  'password-reset': 'Reset your Sear POS password',
  receipt: 'Your receipt',
  statement: 'Your statement is ready',
  'weekly-summary': 'Your weekly Sear POS summary',
}

export async function renderTransactionalEmail<T extends TransactionalEmailType>(
  type: T,
  props: TemplateProps[T],
): Promise<string> {
  switch (type) {
    case 'welcome':
      return render(<WelcomeEmail {...props} />)
    case 'magic-link':
      return render(<MagicLinkEmail {...props} />)
    case 'password-reset':
      return render(<PasswordResetEmail {...props} />)
    case 'receipt':
      return render(<ReceiptEmail {...props} />)
    case 'statement':
      return render(<StatementEmail {...props} />)
    case 'weekly-summary':
      return render(<WeeklySummaryEmail {...props} />)
  }
}

export async function sendTransactionalEmail<T extends TransactionalEmailType>(params: {
  type: T
  to: string
  from?: string
  subject?: string
  props: TemplateProps[T]
}) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const html = await renderTransactionalEmail(params.type, params.props)
  const { data, error } = await resend.emails.send({
    from: params.from ?? process.env.RESEND_FROM_EMAIL ?? 'Sear POS <hello@getsear.com>',
    to: params.to,
    subject: params.subject ?? transactionalEmailSubjects[params.type],
    html,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, messageId: data?.id ?? null }
}
