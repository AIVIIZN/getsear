/**
 * Setup wizard layout — full-screen, no sidebar, clean and minimal.
 * Used exclusively during onboarding flow.
 */
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {children}
    </div>
  )
}
