/**
 * Campaign email — react-email template + render helper.
 *
 * Wraps `EmailLayout`, personalizes with the recipient's first name,
 * embeds a 1x1 open-tracking pixel, rewrites every in-body link through
 * the click-tracking redirect, and ends with an unsubscribe link.
 *
 * The send origin (default https://getsear.com) is overridable via the
 * `MARKETING_TRACKING_ORIGIN` env so dev/staging stays segregated.
 */

import * as React from 'react'
import { render } from '@react-email/render'
import { Img } from '@react-email/components'
import { EmailLayout } from './_layout'

const DEFAULT_TRACKING_ORIGIN = 'https://getsear.com'

function trackingOrigin(): string {
  return process.env.MARKETING_TRACKING_ORIGIN?.replace(/\/+$/, '') || DEFAULT_TRACKING_ORIGIN
}

/**
 * Build the open-tracking pixel URL.
 * Sister task 5.1.4 owns the `/api/marketing/track/open` route.
 */
export function buildOpenPixelUrl(trackingId: string): string {
  return `${trackingOrigin()}/api/marketing/track/open?r=${encodeURIComponent(trackingId)}`
}

/**
 * Build the click-tracking redirect URL for a given target.
 * The target is base64url-encoded so query parameters survive intact.
 */
export function buildClickTrackUrl(trackingId: string, targetUrl: string): string {
  const encoded = Buffer.from(targetUrl, 'utf8').toString('base64url')
  return `${trackingOrigin()}/api/marketing/track/click?r=${encodeURIComponent(
    trackingId,
  )}&u=${encoded}`
}

/**
 * Build the unsubscribe URL for a customer.
 * Token is the customer's `unsubscribe_token` (long-lived, single-purpose).
 */
export function buildUnsubscribeUrl(unsubscribeToken: string): string {
  return `${trackingOrigin()}/api/marketing/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}`
}

/**
 * Rewrite every <a href="..."> in the campaign body to flow through the
 * click-tracking redirect. Only http(s) links are rewritten — mailto/tel/
 * anchor and the unsubscribe link itself are left alone.
 */
export function rewriteBodyLinks(bodyHtml: string, trackingId: string, unsubscribeUrl: string): string {
  return bodyHtml.replace(
    /<a\b([^>]*?)href\s*=\s*(['"])(.*?)\2([^>]*)>/gi,
    (match, pre: string, quote: string, href: string, post: string) => {
      const trimmed = href.trim()
      // Leave non-http links and the unsubscribe link untouched.
      if (!/^https?:\/\//i.test(trimmed)) return match
      if (trimmed === unsubscribeUrl) return match
      const wrapped = buildClickTrackUrl(trackingId, trimmed)
      return `<a${pre}href=${quote}${wrapped}${quote}${post}>`
    },
  )
}

export interface CampaignEmailProps {
  /** Recipient's first name (falls back to "there" inside the template). */
  firstName?: string | null
  /** Restaurant / org display name. */
  orgName: string
  /** Optional org logo URL. */
  orgLogoUrl?: string | null
  /** Optional mailing address (CAN-SPAM). */
  mailingAddress?: string | null
  /** Campaign body — plain HTML or markdown-rendered HTML. Will have its
   *  links rewritten for click tracking before render. */
  bodyHtml: string
  /** Optional preview text shown in inbox. */
  previewText?: string
  /** Tracking ID — used by both the open pixel and click redirect. */
  trackingId: string
  /** Unsubscribe token from the customers row. */
  unsubscribeToken: string
}

export function CampaignEmail({
  firstName,
  orgName,
  orgLogoUrl,
  mailingAddress,
  bodyHtml,
  previewText,
  trackingId,
  unsubscribeToken,
}: CampaignEmailProps) {
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi there,'
  const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken)
  const rewrittenBody = rewriteBodyLinks(bodyHtml, trackingId, unsubscribeUrl)
  const pixelUrl = buildOpenPixelUrl(trackingId)

  return (
    <EmailLayout
      previewText={previewText}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      mailingAddress={mailingAddress}
      unsubscribeUrl={unsubscribeUrl}
    >
      <p style={{ margin: '0 0 16px', fontSize: 16, color: '#1d1d1f' }}>{greeting}</p>
      {/* Body is org-authored HTML; we rely on the marketing composer to
          sanitize and the layout to scope styles. */}
      <div
        style={{ fontSize: 16, lineHeight: 1.6, color: '#1d1d1f' }}
        dangerouslySetInnerHTML={{ __html: rewrittenBody }}
      />
      {/* 1x1 transparent open-tracking pixel. Placed at end of content so
          all visible content paints first. */}
      <Img
        src={pixelUrl}
        alt=""
        width={1}
        height={1}
        style={{ display: 'block', width: 1, height: 1, border: 0 }}
      />
    </EmailLayout>
  )
}

/**
 * Render the campaign email to an HTML string suitable for Resend.
 */
export async function renderCampaignEmail(props: CampaignEmailProps): Promise<string> {
  return render(<CampaignEmail {...props} />)
}

export default CampaignEmail
