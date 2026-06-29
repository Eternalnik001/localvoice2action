// ============================================================
// Dashboard route loading skeleton (Next.js App Router convention).
// Four stat-card skeletons + two chart-area skeletons, matching the real grid.
// ============================================================

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Header placeholder */}
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />

      {/* Four stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
          />
        ))}
      </div>

      {/* Two chart areas */}
      <div className="mt-6 space-y-6">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
      </div>
    </main>
  )
}
