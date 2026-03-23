'use client'

import type { TableData } from '@/stores/ai-store'

interface InlineTableProps {
  data: TableData
}

export function InlineTable({ data }: InlineTableProps) {
  if (!data.headers || data.headers.length === 0) return null

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        border: '0.5px solid var(--border)',
        backgroundColor: 'var(--background)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--separator)' }}>
              {data.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-caption-1 font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  borderBottom:
                    rowIdx < data.rows.length - 1
                      ? '0.5px solid var(--border)'
                      : 'none',
                }}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-3 py-2 text-footnote text-foreground tabular-nums"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
