import { notFound } from 'next/navigation'
import { renderTransactionalEmail, type TransactionalEmailType } from '@/lib/email/send'

const templates: TransactionalEmailType[] = [
  'welcome',
  'magic-link',
  'password-reset',
  'receipt',
  'statement',
  'weekly-summary',
]

export default async function EmailPreviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const params = await searchParams
  const selected = templates.includes(params.template as TransactionalEmailType)
    ? (params.template as TransactionalEmailType)
    : 'welcome'
  const html = await renderTransactionalEmail(selected, { orgName: 'Sear Demo Grill' })

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 24 }}>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {templates.map((template) => (
          <a
            key={template}
            href={`/email-previews?template=${template}`}
            style={{
              borderRadius: 8,
              background: template === selected ? 'var(--color-primary)' : 'var(--color-surface)',
              color: template === selected ? 'var(--color-text-on-primary)' : 'var(--color-text)',
              padding: '8px 12px',
              textDecoration: 'none',
            }}
          >
            {template}
          </a>
        ))}
      </nav>
      <iframe
        title={`${selected} email preview`}
        srcDoc={html}
        style={{
          width: '100%',
          minHeight: 720,
          border: '1px solid var(--color-border)',
          borderRadius: 8,
        }}
      />
    </main>
  )
}
