// ============================================================
// Home route loading skeleton (Next.js App Router convention).
// Shown while the home server component streams. Top-bar placeholder +
// a large map-area grey block, matching the real layout.
// ============================================================

export default function HomeLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Hero placeholder */}
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />

      {/* Map area grey block */}
      <div className="mt-6 h-[60vh] animate-pulse rounded-2xl bg-slate-200" />

      {/* Recent strip placeholders */}
      <div className="mt-6 space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    </main>
  )
}
