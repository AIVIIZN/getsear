export default function OrderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="max-w-lg mx-auto min-h-screen bg-white">
          {children}
        </div>
      </body>
    </html>
  )
}
