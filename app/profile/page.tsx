"use client"

// ============================================================
// /profile — the citizen's civic profile (client component).
// Two-axis gamification: a single COMMUNITY TIER (with progress to the next
// rank) + per-issue-type EXPERTISE badges (5 levels, progress bars), plus the
// achievement badges. All derived anonymously from this device's IP-hash via
// /api/my-badges — no account, no email.
// ============================================================

import { useEffect, useState } from "react"
import Link from "next/link"

interface BadgeLite {
  id: string
  label: string
  emoji: string
}
interface TierProgress {
  current: { id: string; label: string; emoji: string; minReports: number }
  next: { label: string; minReports: number } | null
  reports: number
  reportsToNext: number | null
}
interface ExpertiseLite {
  type: string
  label: string
  emoji: string
  count: number
  level: number
  nextThreshold: number | null
}
interface ProfileData {
  badges: BadgeLite[]
  nickname: string | null
  communityTier: TierProgress
  expertise: ExpertiseLite[]
}

// Mirror of EXPERTISE_LEVELS in lib/badges (for level-relative progress bars).
const EXP_LEVELS = [1, 3, 6, 10, 20]

function tierPct(t: TierProgress): number {
  if (!t.next) return 100
  const span = t.next.minReports - t.current.minReports
  const done = t.reports - t.current.minReports
  return Math.max(0, Math.min(100, span > 0 ? (done / span) * 100 : 100))
}
function expertisePct(e: ExpertiseLite): number {
  if (!e.nextThreshold) return 100
  const prev = e.level > 0 ? EXP_LEVELS[e.level - 1]! : 0
  const span = e.nextThreshold - prev
  const done = e.count - prev
  return Math.max(0, Math.min(100, span > 0 ? (done / span) * 100 : 0))
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/my-badges")
      .then((r) => r.json())
      .then((d: ProfileData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="text-sm font-semibold text-brand-primary hover:underline"
      >
        ← Back to map
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {data?.nickname ? `${data.nickname}'s profile` : "Your profile"}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your civic contribution — earned anonymously, on this device.
      </p>

      {loading && (
        <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
      )}

      {data && (
        <>
          {/* Community tier */}
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Community rank
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {data.communityTier.current.emoji} {data.communityTier.current.label}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {data.communityTier.reports} report
              {data.communityTier.reports === 1 ? "" : "s"}
            </p>
            {data.communityTier.next && (
              <>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: `${tierPct(data.communityTier)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {data.communityTier.reportsToNext} more report
                  {data.communityTier.reportsToNext === 1 ? "" : "s"} to{" "}
                  {data.communityTier.next.label}
                </p>
              </>
            )}
          </section>

          {/* Achievement badges */}
          <section className="mt-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Badges
            </h2>
            {data.badges.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Report or confirm issues to earn badges.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.badges.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/60"
                  >
                    <span aria-hidden>{b.emoji}</span> {b.label}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Expertise tracks */}
          <section className="mt-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Expertise
            </h2>
            <div className="space-y-3">
              {data.expertise.map((e) => (
                <div
                  key={e.type}
                  className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      <span aria-hidden>{e.emoji}</span> {e.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Lvl {e.level}/5
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${expertisePct(e)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {e.nextThreshold
                      ? `${e.nextThreshold - e.count} more ${e.label} report${
                          e.nextThreshold - e.count === 1 ? "" : "s"
                        } to level ${e.level + 1}`
                      : `Maxed out — ${e.count} reports`}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <Link
            href="/report"
            className="mt-6 inline-block rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          >
            📸 Report an issue to level up
          </Link>
        </>
      )}
    </main>
  )
}
