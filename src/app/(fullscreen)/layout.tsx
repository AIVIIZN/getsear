export default function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Optional thin status bar */}
      <div className="absolute inset-x-0 top-0 z-50 flex h-6 items-center justify-end bg-black/60 px-3">
        <span className="text-[10px] font-medium text-white/70">
          Sear POS
        </span>
      </div>

      {/* Full viewport content */}
      <div className="h-full w-full">{children}</div>
    </div>
  );
}
