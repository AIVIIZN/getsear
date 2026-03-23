'use client';

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="text-[24px] font-semibold text-[#1C1C1E]">
        Something went wrong
      </h2>
      <p className="mt-2 text-[15px] text-[#78756D]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="btn-press mt-6 rounded-full bg-[#F06B18] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#E05A0A]"
      >
        Try again
      </button>
    </div>
  );
}
