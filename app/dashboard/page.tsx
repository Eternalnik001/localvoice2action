// ============================================================
// Public impact dashboard (/dashboard) — server component, no auth.
// Accountability page: city stats + category chart + area resolution chart +
// recent activity feed. All values computed from the in-memory DAL. Zero Gemini.
// ============================================================

import Link from "next/link"
import { getStore } from "@/lib/data"
import {
  computeCityStats,
  computeByCategory,
  computeAreaResolution,
  recentActivity,
  computeLeaderboard,
} from "@/lib/data/dashboardStats"
import { DashboardChartsLazy } from "@/components/dashboard/DashboardChartsLazy"
import { InsightCards } from "@/components/dashboard/InsightCards"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MyBadges } from "@/components/MyBadges"
import { SeverityBadge } from "@/components/SeverityBadge"
import { timeAgo } from "@/lib/format"
import type { Issue } from "@/lib/types"

const STATUS_LABEL: Record<Issue["status"], { text: string; className: string }> = {
  OPEN: { text: "Open", className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  ACKNOWLEDGED: { text: "Acknowledged", className: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
  IN_PROGRESS: { text: "In progress", className: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300" },
  RESOLVED: { text: "Resolved", className: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  CLOSED: { text: "Closed", className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
}

const TYPE_LABEL: Record<Issue["issue_type"], string> = {
  POTHOLE: "Pothole",
  WATER_LEAKAGE: "Water leak",
  BROKEN_STREETLIGHT: "Streetlight",
  GARBAGE_OVERFLOW: "Garbage",
  DAMAGED_FOOTPATH: "Footpath",
  ENCROACHMENT: "Encroachment",
  OTHER: "Other",
  NOT_A_CIVIC_ISSUE: "Not civic",
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const issues = await getStore().listIssues()
  const now = Date.now()

  const stats = computeCityStats(issues, now)
  const byCategory = computeByCategory(issues)
  const byArea = computeAreaResolution(issues)
  const recent = recentActivity(issues, 10)
  const leaderboard = computeLeaderboard(issues, 5)

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">
            Impact Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Public accountability for Bengaluru&apos;s civic issues
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold text-brand-primary underline">
          ← Back to map
        </Link>
      </header>

      {/* Tier 2: the viewer's own badges (if they saved a nickname) */}
      <MyBadges />

      {/* Section 1 — city stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total reported" value={String(stats.totalReported)} />
        <StatCard
          label="Resolved this month"
          value={String(stats.resolvedThisMonth)}
          sub={`${stats.resolvedThisMonthPct}% of all issues`}
        />
        <StatCard
          label="Avg resolution time"
          value={
            stats.avgResolutionDays != null
              ? `${stats.avgResolutionDays} days`
              : "—"
          }
        />
        <StatCard
          label="Most active area"
          value={stats.mostActiveArea?.area ?? "—"}
          sub={
            stats.mostActiveArea
              ? `${stats.mostActiveArea.count} issues`
              : undefined
          }
        />
      </section>

      {/* AI insights — Gemini predictive cards (cached hourly, client-fetched) */}
      <ErrorBoundary>
        <InsightCards />
      </ErrorBoundary>

      {/* Sections 2 & 3 — charts */}
      <ErrorBoundary>
        <DashboardChartsLazy byCategory={byCategory} byArea={byArea} />
      </ErrorBoundary>

      {/* Section 4 — recent activity feed */}
      <section className="mt-6 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Recent activity
        </h2>
        <ul className="divide-y divide-slate-100">
          {recent.map((issue) => {
            const status = STATUS_LABEL[issue.status]
            return (
              <li key={issue.id}>
                <Link
                  href={`/issues/${issue.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 transition hover:opacity-80"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {issue.location.area}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {TYPE_LABEL[issue.issue_type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}
                  >
                    {status.text}
                  </span>
                  <SeverityBadge severity={issue.severity} />
                  <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                    {timeAgo(issue.created_at, new Date(now))}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Section 5 — neighbourhood leaderboard */}
      <section className="mt-6 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Most active neighbourhoods this month
        </h2>
        <ol className="space-y-3">
          {leaderboard.map((row, idx) => (
            <li key={row.area} className="flex items-center gap-3">
              <span className="w-6 text-center text-lg font-bold text-slate-400 dark:text-slate-500">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {row.nickname ?? "Anonymous Neighbour"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{row.area}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    · {row.reports} reports
                  </span>
                  {row.topBadge && (
                    <span
                      title={row.topBadge.description}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60"
                    >
                      <span aria-hidden>{row.topBadge.emoji}</span>
                      {row.topBadge.label}
                    </span>
                  )}
                </div>
                {/* Resolution-rate mini progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${row.resolutionRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {row.resolutionRate}% resolved
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
