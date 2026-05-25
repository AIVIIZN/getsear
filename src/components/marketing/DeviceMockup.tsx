interface DeviceMockupProps {
  /** Content to render inside the iPad frame */
  children: React.ReactNode;
  /** Optional extra class for sizing */
  className?: string;
}

export function DeviceMockup({ children, className = '' }: DeviceMockupProps) {
  return (
    <div className={`relative mx-auto ${className}`}>
      {/* iPad outer shell */}
      <div className="relative overflow-hidden rounded-[24px] border-[8px] border-[var(--color-text)] bg-[var(--color-text)] shadow-2xl md:rounded-[32px] md:border-[12px]">
        {/* Camera notch */}
        <div className="absolute left-1/2 top-0 z-10 h-[6px] w-[60px] -translate-x-1/2 rounded-b-full bg-[var(--color-bg-muted)] md:h-[8px] md:w-[80px]" />

        {/* Screen content */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-bg-muted)]">
          {children}
        </div>
      </div>

      {/* Reflection glare */}
      <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-br from-white/10 via-transparent to-transparent md:rounded-[32px]" />
    </div>
  );
}
