'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PrinterConfig, PrinterStatus } from '@/lib/printing/printer-interface';

export interface PrinterWithStatus extends PrinterConfig {
  liveStatus: PrinterStatus | null;
}

interface UsePrinterStatusReturn {
  printers: PrinterWithStatus[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook that fetches printers for the current location and polls their status.
 * @param locationId - The location to fetch printers for
 * @param pollInterval - Polling interval in ms (default 30000)
 */
export function usePrinterStatus(
  locationId: string | null,
  pollInterval = 30_000
): UsePrinterStatusReturn {
  const [printers, setPrinters] = useState<PrinterWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrinters = useCallback(async () => {
    if (!locationId) {
      setPrinters([]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/printing/printers?location_id=${encodeURIComponent(locationId)}`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch printers (${res.status})`);
      }

      const json = (await res.json()) as { data: PrinterConfig[] };
      const configs = json.data ?? [];

      // Map to PrinterWithStatus — status will be fetched separately
      const withStatus: PrinterWithStatus[] = configs.map((cfg) => ({
        ...cfg,
        liveStatus: null,
      }));

      setPrinters(withStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load printers');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchPrinters();
  }, [fetchPrinters]);

  // Initial fetch
  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      fetchPrinters();
    }, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPrinters, pollInterval]);

  return { printers, isLoading, error, refresh };
}
