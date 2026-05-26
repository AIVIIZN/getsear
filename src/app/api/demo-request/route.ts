import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server';
import { z } from 'zod';

const demoRequestSchema = z.object({
  restaurant_name: z.string().min(1).max(200),
  contact_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/),
  locations_count: z.coerce.number().min(1).max(999),
  current_pos: z.enum([
    'toast',
    'square',
    'spoton',
    'clover',
    'rpower',
    'other',
    'none',
  ]),
  source_page: z.string().optional(),
  utm_params: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = demoRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(400, 'Validation failed', { details: parsed.error.flatten().fieldErrors, extra: { "details": parsed.error.flatten().fieldErrors } });
    }

    const data = parsed.data;

    // Store in Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase.from('demo_requests').insert({
          restaurant_name: data.restaurant_name,
          contact_name: data.contact_name,
          email: data.email,
          phone: data.phone,
          locations_count: data.locations_count,
          current_pos: data.current_pos,
          source_page: data.source_page ?? null,
          utm_params: data.utm_params ?? null,
        });
      } catch (dbError) {
        // Log but don't fail the request — we still want the confirmation email
        console.error('Failed to store demo request in DB:', dbError);
      }
    }

    // Send confirmation email via SendGrid
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || 'hello@getsear.com';

    if (sendgridApiKey) {
      try {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: data.email, name: data.contact_name }],
                subject: `Thanks for your interest in Sear POS, ${data.contact_name}!`,
              },
            ],
            from: {
              email: sendgridFromEmail,
              name: 'Sear POS',
            },
            content: [
              {
                type: 'text/html',
                value: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 40px; height: 40px; background: var(--color-primary); border-radius: 10px; line-height: 40px; color: white; font-weight: bold; font-size: 20px;">S</div>
                    </div>
                    <h1 style="font-size: 24px; color: var(--color-text); margin-bottom: 16px;">Thanks for reaching out, ${data.contact_name}!</h1>
                    <p style="font-size: 16px; color: var(--color-marketing-text-muted); line-height: 1.6;">We received your demo request for <strong>${data.restaurant_name}</strong>. A member of our team will reach out within 2 business hours to schedule your personalized demo.</p>
                    <p style="font-size: 16px; color: var(--color-marketing-text-muted); line-height: 1.6;">In the meantime, you can explore:</p>
                    <ul style="font-size: 16px; color: var(--color-marketing-text-muted); line-height: 1.8;">
                      <li><a href="https://getsear.com/pricing" style="color: var(--color-primary);">Our transparent pricing</a></li>
                      <li><a href="https://getsear.com/compare" style="color: var(--color-primary);">How we compare to Toast, Square, and others</a></li>
                      <li><a href="https://getsear.com/pricing#calculator" style="color: var(--color-primary);">Your savings calculator</a></li>
                    </ul>
                    <hr style="border: none; border-top: 1px solid var(--color-marketing-bg-soft); margin: 32px 0;" />
                    <p style="font-size: 13px; color: var(--color-neutral-350);">Sear POS &middot; getsear.com &middot; No contracts, no lock-in.</p>
                  </div>
                `,
              },
            ],
          }),
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    // Also send internal notification
    if (sendgridApiKey) {
      try {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: sendgridFromEmail }],
                subject: `New demo request: ${data.restaurant_name} (${data.locations_count} location${data.locations_count > 1 ? 's' : ''})`,
              },
            ],
            from: {
              email: sendgridFromEmail,
              name: 'Sear POS Leads',
            },
            content: [
              {
                type: 'text/plain',
                value: `New demo request:\n\nRestaurant: ${data.restaurant_name}\nContact: ${data.contact_name}\nEmail: ${data.email}\nPhone: ${data.phone}\nLocations: ${data.locations_count}\nCurrent POS: ${data.current_pos}\nSource: ${data.source_page ?? 'N/A'}\nUTM: ${JSON.stringify(data.utm_params ?? {})}`,
              },
            ],
          }),
        });
      } catch (notifyError) {
        console.error('Failed to send internal notification:', notifyError);
      }
    }

    return NextResponse.json(
      { success: true, message: 'Demo request received' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Demo request error:', error);
    return apiError(500, 'Internal server error');
  }
}
