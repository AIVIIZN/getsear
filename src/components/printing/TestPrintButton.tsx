'use client';

import { useState } from 'react';
import { Loader2, Check, X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TestPrintButtonProps {
  printerId: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

type TestState = 'idle' | 'printing' | 'success' | 'error';

export function TestPrintButton({
  printerId,
  className,
  size = 'default',
}: TestPrintButtonProps) {
  const [state, setState] = useState<TestState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleTestPrint() {
    setState('printing');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/printing/printers/${printerId}/test`, {
        method: 'POST',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(json.error ?? `Test print failed (${res.status})`);
      }

      setState('success');
      // Reset to idle after 3 seconds
      setTimeout(() => setState('idle'), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test print failed';
      setErrorMessage(message);
      setState('error');
      // Reset to idle after 5 seconds
      setTimeout(() => {
        setState('idle');
        setErrorMessage(null);
      }, 5000);
    }
  }

  const stateConfig = {
    idle: {
      icon: <Printer className="h-4 w-4" />,
      label: 'Test Print',
      variant: 'outline' as const,
      disabled: false,
    },
    printing: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      label: 'Printing...',
      variant: 'outline' as const,
      disabled: true,
    },
    success: {
      icon: <Check className="h-4 w-4" />,
      label: 'Printed!',
      variant: 'outline' as const,
      disabled: true,
    },
    error: {
      icon: <X className="h-4 w-4" />,
      label: 'Failed',
      variant: 'outline' as const,
      disabled: true,
    },
  };

  const config = stateConfig[state];

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={config.variant}
        size={size}
        disabled={config.disabled}
        onClick={handleTestPrint}
        className={cn(
          'gap-2 touch-target transition-colors',
          state === 'success' && 'border-[var(--success)] text-[var(--success)]',
          state === 'error' && 'border-[var(--error)] text-[var(--error)]',
          className
        )}
      >
        {config.icon}
        {size !== 'icon' && config.label}
      </Button>
      {state === 'error' && errorMessage && (
        <p className="text-xs text-[var(--error)] max-w-[200px]">{errorMessage}</p>
      )}
    </div>
  );
}
