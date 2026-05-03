'use client'

import { useState, useCallback } from 'react'
import {
  Printer,
  Wifi,
  Usb,
  Bluetooth,
  Search,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  CreditCard,
  ArrowLeft,
  Loader2,
  TestTube2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type HWStep = 'brand' | 'connection' | 'discover' | 'test' | 'assign' | 'terminal_model' | 'terminal_pair' | 'done'

const PRINTER_BRANDS = [
  { id: 'star', name: 'Star Micronics', description: 'TSP143, SP700, mC-Print' },
  { id: 'epson', name: 'Epson', description: 'TM-T88, TM-T20, TM-m30' },
  { id: 'other', name: 'Other / Generic', description: 'Any ESC/POS compatible' },
]

const CONNECTION_TYPES = [
  { id: 'network', name: 'Network (WiFi/Ethernet)', description: 'Connected to your local network', icon: Wifi },
  { id: 'usb', name: 'USB', description: 'Plugged directly into this device', icon: Usb },
  { id: 'bluetooth', name: 'Bluetooth', description: 'Paired wirelessly', icon: Bluetooth },
]

const PRINTER_ROLES = [
  { id: 'receipt', name: 'Receipt Printer', description: 'Prints customer receipts at POS' },
  { id: 'kitchen', name: 'Kitchen Printer', description: 'Prints tickets for the kitchen line' },
  { id: 'bar', name: 'Bar Printer', description: 'Prints drink orders for the bar' },
]

const VALOR_TERMINALS = [
  { id: 'vp800', name: 'VP800', description: 'Countertop terminal with touchscreen' },
  { id: 'vp550', name: 'VP550', description: 'Compact countertop terminal' },
  { id: 'vp300pro', name: 'VP300 Pro', description: 'Customer-facing PIN pad' },
  { id: 'rckt', name: 'RCKT', description: 'Mobile Bluetooth terminal' },
]

interface TroubleshootSection {
  question: string
  answer: string
}

const TROUBLESHOOT_BY_STEP: Record<string, TroubleshootSection[]> = {
  discover: [
    { question: 'Printer not found on network?', answer: 'Make sure the printer and this device are on the same WiFi network. Check that the printer is powered on and connected. Some printers have a settings sheet you can print by holding the feed button.' },
    { question: 'USB printer not detected?', answer: 'Try unplugging and reconnecting the USB cable. Make sure you are using a data cable, not a charging-only cable. Some printers require a driver, but most ESC/POS printers work automatically.' },
    { question: 'Bluetooth not pairing?', answer: 'Put the printer in pairing mode (usually hold the power or Bluetooth button). Make sure Bluetooth is enabled on your device. Remove any old pairings and try again.' },
  ],
  test: [
    { question: 'Test print did not come out?', answer: 'Check the paper roll. Make sure the paper is loaded correctly and the cover is fully closed. Try turning the printer off and back on.' },
    { question: 'Print is blank or garbled?', answer: 'If blank, the paper may be loaded upside down. Remove and flip the paper roll. If garbled, try selecting a different printer brand.' },
  ],
  terminal_pair: [
    { question: 'Terminal is not connecting?', answer: 'Make sure the terminal is powered on and connected to the same network. For Bluetooth terminals (RCKT), ensure the terminal is in pairing mode.' },
    { question: 'Where do I find my Terminal ID?', answer: 'The Terminal ID (TID) is printed on the bottom of your Valor terminal or can be found in the terminal settings menu under "Device Info".' },
  ],
}

interface HardwareSubWizardProps {
  onComplete: () => void
  onBack: () => void
}

export function HardwareSubWizard({ onComplete, onBack }: HardwareSubWizardProps) {
  const [step, setStep] = useState<HWStep>('brand')
  const [brand, setBrand] = useState<string | null>(null)
  const [connection, setConnection] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [foundPrinters, setFoundPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null)
  const [printerRole, setPrinterRole] = useState<string | null>(null)
  const [terminalModel, setTerminalModel] = useState<string | null>(null)
  const [testPrintSuccess, setTestPrintSuccess] = useState<boolean | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [expandedTroubleshoot, setExpandedTroubleshoot] = useState<number | null>(null)

  const handleScan = useCallback(() => {
    setIsScanning(true)
    // Simulate network discovery
    setTimeout(() => {
      if (connection === 'network') {
        setFoundPrinters([
          `${brand === 'star' ? 'Star TSP143' : brand === 'epson' ? 'Epson TM-T88VI' : 'ESC/POS Printer'} (192.168.1.100)`,
        ])
      } else if (connection === 'bluetooth') {
        setFoundPrinters([
          `${brand === 'star' ? 'Star mC-Print3' : brand === 'epson' ? 'Epson TM-m30' : 'BT Printer'} (Bluetooth)`,
        ])
      } else {
        setFoundPrinters([
          `${brand === 'star' ? 'Star TSP143' : brand === 'epson' ? 'Epson TM-T20III' : 'USB Printer'} (USB)`,
        ])
      }
      setIsScanning(false)
    }, 2500)
  }, [brand, connection])

  const handleTestPrint = useCallback(() => {
    setIsTesting(true)
    setTimeout(() => {
      setTestPrintSuccess(true)
      setIsTesting(false)
    }, 2000)
  }, [])

  const goToStep = useCallback((newStep: HWStep) => {
    setStep(newStep)
    setExpandedTroubleshoot(null)
  }, [])

  const troubleshootItems = TROUBLESHOOT_BY_STEP[step] ?? []

  const renderTroubleshoot = () => {
    if (troubleshootItems.length === 0) return null
    return (
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <button
          onClick={() => setExpandedTroubleshoot(expandedTroubleshoot === -1 ? null : -1)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-footnote font-medium text-[var(--muted-foreground)]">Having trouble?</span>
          <ChevronDown className={cn('h-4 w-4 text-[var(--muted-foreground)] transition-transform', expandedTroubleshoot !== null && 'rotate-180')} />
        </button>
        {expandedTroubleshoot !== null && (
          <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
            {troubleshootItems.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedTroubleshoot(expandedTroubleshoot === i ? null : i)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-[var(--warning)]" />
                  <span className="text-footnote font-medium text-[var(--foreground)]">{item.question}</span>
                </button>
                {expandedTroubleshoot === i && (
                  <p className="mt-1.5 ml-5.5 text-footnote text-[var(--muted-foreground)]">{item.answer}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button onClick={step === 'brand' ? onBack : () => {
        const prevSteps: Record<HWStep, HWStep> = {
          brand: 'brand',
          connection: 'brand',
          discover: 'connection',
          test: 'discover',
          assign: 'test',
          terminal_model: 'assign',
          terminal_pair: 'terminal_model',
          done: 'terminal_pair',
        }
        goToStep(prevSteps[step])
      }} className="text-callout text-[var(--primary)] btn-press flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Step: Brand Picker */}
      {step === 'brand' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">What printer brand do you have?</h2>
          </div>
          <div className="grid gap-3">
            {PRINTER_BRANDS.map((b) => (
              <button
                key={b.id}
                onClick={() => { setBrand(b.id); goToStep('connection') }}
                className={cn(
                  'flex items-center gap-4 rounded-2xl border p-5 text-left transition-all btn-press',
                  brand === b.id
                    ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-md'
                    : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--secondary)]">
                  <Printer className="h-6 w-6 text-[var(--foreground)]" />
                </div>
                <div>
                  <span className="text-headline text-[var(--foreground)]">{b.name}</span>
                  <p className="text-footnote text-[var(--muted-foreground)]">{b.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step: Connection Type */}
      {step === 'connection' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">How is it connected?</h2>
          </div>
          <div className="grid gap-3">
            {CONNECTION_TYPES.map((ct) => (
              <button
                key={ct.id}
                onClick={() => { setConnection(ct.id); goToStep('discover') }}
                className={cn(
                  'flex items-center gap-4 rounded-2xl border p-5 text-left transition-all btn-press',
                  connection === ct.id
                    ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-md'
                    : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--secondary)]">
                  <ct.icon className="h-6 w-6 text-[var(--foreground)]" />
                </div>
                <div>
                  <span className="text-headline text-[var(--foreground)]">{ct.name}</span>
                  <p className="text-footnote text-[var(--muted-foreground)]">{ct.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step: Auto-Discovery */}
      {step === 'discover' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">Searching for printers</h2>
            <p className="mt-1 text-body text-[var(--muted-foreground)]">
              Make sure your printer is powered on and connected.
            </p>
          </div>

          {!isScanning && foundPrinters.length === 0 && (
            <div className="flex justify-center py-8">
              <Button onClick={handleScan} className="h-14 rounded-2xl px-8 text-callout font-semibold">
                <Search className="mr-2 h-5 w-5" />
                Scan for Printers
              </Button>
            </div>
          )}

          {isScanning && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-[var(--primary)]" />
              <span className="text-body text-[var(--muted-foreground)]">Scanning your network...</span>
            </div>
          )}

          {foundPrinters.length > 0 && (
            <div className="space-y-3">
              {foundPrinters.map((printer) => (
                <button
                  key={printer}
                  onClick={() => { setSelectedPrinter(printer); goToStep('test') }}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all btn-press',
                    selectedPrinter === printer
                      ? 'border-[var(--primary)] bg-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm'
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success-bg)]">
                    <Check className="h-5 w-5 text-[var(--success)]" />
                  </div>
                  <div className="flex-1">
                    <span className="text-callout font-medium text-[var(--foreground)]">{printer}</span>
                    <p className="text-footnote text-[var(--success)]">Found on network</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)]" />
                </button>
              ))}

              <button
                onClick={() => goToStep('test')}
                className="w-full rounded-xl border border-dashed border-[var(--border)] py-3 text-footnote text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                Enter printer IP address manually
              </button>
            </div>
          )}
          {renderTroubleshoot()}
        </>
      )}

      {/* Step: Test Print */}
      {step === 'test' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">Test your printer</h2>
            <p className="mt-1 text-body text-[var(--muted-foreground)]">
              Let&apos;s make sure the printer is working correctly.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-warm-sm">
            <p className="mb-4 text-callout text-[var(--foreground)]">
              {selectedPrinter ?? 'Manual printer'}
            </p>

            {testPrintSuccess === null && (
              <Button
                onClick={handleTestPrint}
                disabled={isTesting}
                className="h-14 rounded-2xl px-10 text-callout font-semibold"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Printing...
                  </>
                ) : (
                  <>
                    <TestTube2 className="mr-2 h-5 w-5" />
                    Print Test Page
                  </>
                )}
              </Button>
            )}

            {testPrintSuccess === true && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-6 w-6 text-[var(--success)]" />
                  <span className="text-headline text-[var(--success)]">Test print successful!</span>
                </div>
                <Button
                  onClick={() => goToStep('assign')}
                  className="h-12 rounded-xl px-8 text-callout font-semibold"
                >
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {renderTroubleshoot()}
        </>
      )}

      {/* Step: Assign Role */}
      {step === 'assign' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">Assign printer role</h2>
            <p className="mt-1 text-body text-[var(--muted-foreground)]">
              What will this printer be used for?
            </p>
          </div>
          <div className="grid gap-3">
            {PRINTER_ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => { setPrinterRole(role.id); goToStep('terminal_model') }}
                className={cn(
                  'flex items-center gap-4 rounded-2xl border p-5 text-left transition-all btn-press',
                  printerRole === role.id
                    ? 'border-[var(--primary)] bg-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md'
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary)]">
                  <Printer className="h-5 w-5 text-[var(--foreground)]" />
                </div>
                <div>
                  <span className="text-headline text-[var(--foreground)]">{role.name}</span>
                  <p className="text-footnote text-[var(--muted-foreground)]">{role.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step: Terminal Model */}
      {step === 'terminal_model' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">Payment terminal</h2>
            <p className="mt-1 text-body text-[var(--muted-foreground)]">
              Which Valor terminal model do you have?
            </p>
          </div>
          <div className="grid gap-3">
            {VALOR_TERMINALS.map((terminal) => (
              <button
                key={terminal.id}
                onClick={() => { setTerminalModel(terminal.id); goToStep('terminal_pair') }}
                className={cn(
                  'flex items-center gap-4 rounded-2xl border p-5 text-left transition-all btn-press',
                  terminalModel === terminal.id
                    ? 'border-[var(--primary)] bg-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md'
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]">
                  <CreditCard className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <span className="text-headline text-[var(--foreground)]">{terminal.name}</span>
                  <p className="text-footnote text-[var(--muted-foreground)]">{terminal.description}</p>
                </div>
              </button>
            ))}

            <button
              onClick={onComplete}
              className="w-full rounded-xl border border-dashed border-[var(--border)] py-3 text-footnote text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              Skip payment terminal setup
            </button>
          </div>
        </>
      )}

      {/* Step: Terminal Pairing Instructions */}
      {step === 'terminal_pair' && (
        <>
          <div className="text-center">
            <h2 className="text-title-2 font-semibold text-[var(--foreground)]">
              Pair your {VALOR_TERMINALS.find((t) => t.id === terminalModel)?.name ?? 'terminal'}
            </h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-warm-sm">
              <h3 className="mb-3 text-headline text-[var(--foreground)]">Follow these steps:</h3>
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-caption-1 font-semibold text-white">1</span>
                  <span className="text-callout text-[var(--foreground)]">Power on your Valor terminal and ensure it is connected to the same network as your POS device.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-caption-1 font-semibold text-white">2</span>
                  <span className="text-callout text-[var(--foreground)]">On the terminal, navigate to Settings and find the Terminal ID (TID) and IP address.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-caption-1 font-semibold text-white">3</span>
                  <span className="text-callout text-[var(--foreground)]">The terminal will appear in your POS when you process your first payment. Card data never passes through Sear servers.</span>
                </li>
                {terminalModel === 'rckt' && (
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-caption-1 font-semibold text-white">4</span>
                    <span className="text-callout text-[var(--foreground)]">For RCKT (Bluetooth): Hold the Bluetooth button on the terminal until the LED blinks. Then pair from your device&apos;s Bluetooth settings.</span>
                  </li>
                )}
              </ol>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onComplete}
              className="h-12 rounded-xl bg-[var(--primary)] px-8 text-callout font-semibold text-white shadow-warm-md"
            >
              Finish Hardware Setup
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {renderTroubleshoot()}
        </>
      )}
    </div>
  )
}
