// ============================================================
// Report route loading skeleton (Next.js App Router convention).
// Upload-area skeleton + form-field skeletons, matching the real layout.
// ============================================================

export default function ReportLoading() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      {/* Title + subtitle placeholders */}
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />

      {/* Note field (label + textarea) */}
      <div className="mt-6">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-1 h-20 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Upload area (tall, easy-tap) */}
      <div className="mt-4 h-48 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
    </main>
  )
}
