import { NextRequest, NextResponse } from 'next/server'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'
  const target = `${appUrl}/loyalty/signup${orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''}`
  const escapedTarget = escapeXml(target)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144" role="img" aria-label="Loyalty signup QR">
  <rect width="144" height="144" fill="white"/>
  <rect x="12" y="12" width="34" height="34" fill="black"/>
  <rect x="20" y="20" width="18" height="18" fill="white"/>
  <rect x="98" y="12" width="34" height="34" fill="black"/>
  <rect x="106" y="20" width="18" height="18" fill="white"/>
  <rect x="12" y="98" width="34" height="34" fill="black"/>
  <rect x="20" y="106" width="18" height="18" fill="white"/>
  <path d="M58 18h8v8h-8zM74 18h8v16h-8zM58 42h24v8H58zM90 58h8v8h-8zM106 58h8v16h-8zM58 66h16v8H58zM82 74h8v8h-8zM98 82h24v8H98zM58 98h8v24h-8zM74 98h16v8H74zM98 106h8v8h-8zM114 114h12v12h-12z" fill="black"/>
  <text x="72" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" fill="black">${escapedTarget}</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
