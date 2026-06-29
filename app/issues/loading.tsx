// ============================================================
// Issue route loading skeleton (Next.js App Router convention).
// Covers /issues/[id]. Issue-card skeleton + a slider placeholder block.
// ============================================================

export default function IssueLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Back-link placeholder */}
      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />

      {/* Issue intro card skeleton */}
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="mt-3 h-7 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-1.5 h-4 w-5/6 animate-pulse rounded bg-slate-200" />
      </div>

      {/* Before/After slider placeholder */}
      <div className="mt-6 aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-200" />
    </main>
  )
}
