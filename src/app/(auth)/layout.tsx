export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--background)] via-[var(--secondary)] to-[var(--muted)] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--primary)]">
            SEAR
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Restaurant Point of Sale
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
