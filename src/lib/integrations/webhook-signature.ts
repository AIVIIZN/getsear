/**
 * Webhook HMAC-SHA256 Signature Utility
 *
 * Signs webhook payloads with the endpoint's secret key.
 * Third-party receivers verify the signature to ensure authenticity.
 */

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 *
 * @param payload - The JSON string payload
 * @param secret - The webhook secret key
 * @returns hex-encoded HMAC signature
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex')
}

/**
 * Verify an HMAC-SHA256 signature.
 *
 * @param payload - The raw JSON string payload
 * @param signature - The received signature (from X-Sear-Signature header)
 * @param secret - The webhook secret key
 * @returns true if signature is valid
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret)

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Generate the X-Sear-Signature header value.
 * Format: sha256=<hex>
 */
export function generateSignatureHeader(payload: string, secret: string): string {
  return `sha256=${signPayload(payload, secret)}`
}

/**
 * Sample verification code for documentation / webhook settings UI.
 */
export const VERIFICATION_SAMPLES = {
  node: `const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your Express handler:
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-sear-signature'];
  const isValid = verifyWebhook(
    JSON.stringify(req.body),
    signature,
    process.env.SEAR_WEBHOOK_SECRET
  );
  if (!isValid) return res.status(401).send('Invalid signature');
  // Process webhook...
  res.status(200).send('OK');
});`,

  python: `import hmac
import hashlib
import json

def verify_webhook(payload: str, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# In your Flask handler:
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Sear-Signature', '')
    is_valid = verify_webhook(
        request.get_data(as_text=True),
        signature,
        os.environ['SEAR_WEBHOOK_SECRET']
    )
    if not is_valid:
        return 'Invalid signature', 401
    # Process webhook...
    return 'OK', 200`,
}
