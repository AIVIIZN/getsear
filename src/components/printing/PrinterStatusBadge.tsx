'use client';

import { cn } from '@/lib/utils';

interface PrinterStatusBadgeProps {
  status: 'online' | 'offline' | 'error';
  className?: string;
}

export function PrinterStatusBadge({ status, className }: PrinterStatusBadgeProps) {
  const statusConfig = {
    online: {
      label: 'Online',
      dotColor: 'bg-[var(--success)]',
      textColor: 'text-[var(--success)]',
      pulse: true,
    },
    offline: {
      label: 'Offline',
      dotColor: 'bg-[var(--text-muted)]',
      textColor: 'text-[var(--text-muted)]',
      pulse: false,
    },
    error: {
      label: 'Error',
      dotColor: 'bg-[var(--error)]',
      textColor: 'text-[var(--error)]',
      pulse: false,
    },
  } as const;

  const config = statusConfig[status];

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-3 w-3">
        {config.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.dotColor
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex h-3 w-3 rounded-full',
            config.dotColor
          )}
        />
      </span>
      <span className={cn('text-sm font-medium', config.textColor)}>
        {config.label}
      </span>
    </span>
  );
}
