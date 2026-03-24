'use client';

import { useState, useCallback, useRef } from 'react';
import { Loader2, Wifi, WifiOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DiscoveredDevice {
  ip: string;
  port: number;
  type: 'web' | 'raw';
  responseTime: number;
}

interface NetworkPrinterScannerProps {
  onSelect: (ip: string, port: number) => void;
}

const SUBNETS = [
  { label: '192.168.1.x', prefix: '192.168.1' },
  { label: '192.168.0.x', prefix: '192.168.0' },
  { label: '10.0.0.x', prefix: '10.0.0' },
  { label: '10.0.1.x', prefix: '10.0.1' },
];

// Batch size for concurrent requests
const BATCH_SIZE = 25;
const TIMEOUT_MS = 1500;

async function probeHost(
  ip: string,
  port: number
): Promise<{ reachable: boolean; responseTime: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Try fetching — if the host is up and has a web server, we'll get some response
    // For port 80, use http. For others, we try http too since fetch only does http/https
    await fetch(`http://${ip}:${port}/`, {
      method: 'HEAD',
      mode: 'no-cors', // Important: we don't need to read the response, just check if host responds
      signal: controller.signal,
    });

    clearTimeout(timer);
    return { reachable: true, responseTime: Date.now() - start };
  } catch (err) {
    // AbortError means timeout — host didn't respond
    // TypeError can also mean host responded but CORS blocked — that's actually a positive signal!
    if (err instanceof TypeError && Date.now() - start < TIMEOUT_MS) {
      // Quick TypeError often means the host is up but blocked by CORS — it's a printer!
      return { reachable: true, responseTime: Date.now() - start };
    }
    return { reachable: false, responseTime: Date.now() - start };
  }
}

export function NetworkPrinterScanner({ onSelect }: NetworkPrinterScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [selectedSubnet, setSelectedSubnet] = useState(SUBNETS[0].prefix);
  const [customSubnet, setCustomSubnet] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [progress, setProgress] = useState(0);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const abortRef = useRef(false);

  const subnet = useCustom ? customSubnet : selectedSubnet;

  const handleScan = useCallback(async () => {
    if (!subnet || scanning) return;

    abortRef.current = false;
    setScanning(true);
    setProgress(0);
    setDiscovered([]);
    setScanComplete(false);

    const found: DiscoveredDevice[] = [];
    const totalIPs = 254;
    let scanned = 0;

    // Scan in batches
    for (let batchStart = 1; batchStart <= 254; batchStart += BATCH_SIZE) {
      if (abortRef.current) break;

      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, 254);
      const promises: Promise<void>[] = [];

      for (let i = batchStart; i <= batchEnd; i++) {
        const ip = `${subnet}.${i}`;

        // Probe web interface port
        promises.push(
          probeHost(ip, 80).then((result) => {
            if (result.reachable) {
              const device: DiscoveredDevice = {
                ip,
                port: 80,
                type: 'web',
                responseTime: result.responseTime,
              };
              found.push(device);
              setDiscovered((prev) => [...prev, device]);
            }
          })
        );
      }

      await Promise.allSettled(promises);
      scanned += batchEnd - batchStart + 1;
      setProgress(Math.round((scanned / totalIPs) * 100));
    }

    setScanning(false);
    setScanComplete(true);
  }, [subnet, scanning]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  return (
    <div className="space-y-4">
      {/* Subnet picker */}
      <div>
        <span className="text-subhead font-medium text-muted-foreground mb-2 block">
          Network Range
        </span>
        <div className="grid grid-cols-2 gap-2">
          {SUBNETS.map((s) => (
            <button
              key={s.prefix}
              type="button"
              onClick={() => {
                setSelectedSubnet(s.prefix);
                setUseCustom(false);
              }}
              className={cn(
                'rounded-lg border-2 px-3 py-2.5 text-sm font-mono font-medium transition-all touch-target',
                !useCustom && selectedSubnet === s.prefix
                  ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]'
                  : 'border-[var(--border)] text-muted-foreground hover:border-[var(--border-hover)]'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Custom subnet input */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={cn(
              'rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all touch-target shrink-0',
              useCustom
                ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]'
                : 'border-[var(--border)] text-muted-foreground hover:border-[var(--border-hover)]'
            )}
          >
            Custom
          </button>
          {useCustom && (
            <input
              type="text"
              className="h-10 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-sm"
              placeholder="172.16.0"
              value={customSubnet}
              onChange={(e) => setCustomSubnet(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Scan button + progress */}
      <div className="flex items-center gap-2">
        {scanning ? (
          <>
            <Button
              variant="outline"
              onClick={handleStop}
              className="h-11 gap-2 touch-target flex-1"
            >
              Stop Scan
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                <span>
                  Scanning {subnet}.* — {progress}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--border)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <Button
            onClick={handleScan}
            disabled={!subnet}
            className="h-11 gap-2 btn-press touch-target w-full"
          >
            <Search className="h-4 w-4" />
            Scan for Printers
          </Button>
        )}
      </div>

      {/* Results */}
      {discovered.length > 0 && (
        <div>
          <span className="text-subhead font-medium text-muted-foreground mb-2 block">
            Found {discovered.length} device{discovered.length !== 1 ? 's' : ''}
          </span>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {discovered
              .sort((a, b) => a.responseTime - b.responseTime)
              .map((device) => (
                <button
                  key={`${device.ip}:${device.port}`}
                  type="button"
                  onClick={() =>
                    onSelect(device.ip, device.port === 80 ? 9100 : device.port)
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-left hover:border-[var(--primary)] hover:bg-[var(--primary-subtle)] transition-all touch-target"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                    <Wifi className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold font-mono text-foreground">
                      {device.ip}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Port {device.port} · {device.responseTime}ms response
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[var(--primary)]">
                    Select
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* No results */}
      {scanComplete && discovered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-[var(--background-muted)] p-6 text-center">
          <WifiOff className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No devices found
          </p>
          <p className="text-xs text-muted-foreground/70">
            Try a different subnet, or enter the IP address manually below.
          </p>
        </div>
      )}
    </div>
  );
}
