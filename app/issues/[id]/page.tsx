// ============================================================
// Issue detail page (server component).
// Reads the issue from the data-access layer. Renders the Before/After slider
// (Feature 1) only when the issue is RESOLVED and has a resolution photo.
// The Nearby Citizens card + voting bar (Features 2 / community) come next.
// ============================================================

import Link from "next/link"
import { notFound } from "next/navigation"
import { getStore } from "@/lib/data"
import { statusText } from "@/lib/format"
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider"
import { NearbyCitizensCard } from "@/components/NearbyCitizensCard"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { IssueTimeline } from "@/components/issues/IssueTimeline"
import { BadgePills } from "@/components/BadgePills"
import { MyBadges } from "@/components/MyBadges"
import { SeverityBadge } from "@/components/SeverityBadge"
import { deriveBadgesForToken } from "@/lib/badges"
import type { Issue, Agent5Output } from "@/lib/types"
import type { ResolutionVerdict } from "@/components/BeforeAfterSlider"
import type { ImpactEstimate } from "@/lib/agents/impactEstimator"

// Map the canonical Agent-5 resolution status onto the slider's prop union.
function toVerdict(
  status: Agent5Output["resolution_status"] | null
): ResolutionVerdict | undefined {
  switch (status) {
    case "RESOLVED":
      return "resolved"
    case "PARTIALLY_RESOLVED":
      return "partial"
    case "NOT_RESOLVED":
      return "not_resolved"
    case "CANNOT_DETERMINE":
      return "cant_tell"
    default:
      return undefined
  }
}

// Derive an ImpactEstimate for the card. Prefer a cached estimate on the issue;
// otherwise produce a deterministic, plausible one from the issue's signals so
// the page renders instantly without a per-view Gemini call. (A live estimate
// can be fetched client-side later via /api/estimate-impact.)
function impactFor(issue: Issue): ImpactEstimate {
  const cached = issue.impact_estimate
  if (cached) {
    return {
      residents: cached.nearby_residents,
      commuters: cached.commuters,
      businesses: cached.businesses,
      deliveryPartners: cached.delivery_partners,
      tagline: cached.reasoning,
    }
  }
  const sev = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[issue.severity]
  const confirms = issue.confirmations?.still_there ?? issue.upvotes
  const residents = 20 * sev + confirms * 2
  return {
    residents,
    commuters: residents * 2,
    businesses: Math.max(2, sev * 3),
    deliveryPartners: Math.max(3, sev * 5),
    tagline: `You're not alone — an estimated ${residents + residents * 2} neighbours in ${issue.location.area} are affected.`,
  }
}

export default async function IssueDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const store = getStore()
  const issue: Issue | null = await store.getIssue(params.id)
  if (!issue) notFound()

  // Reporter's earned badges (derived from all issues by their anonymous token).
  const reporterBadges = issue.reporter_token
    ? deriveBadgesForToken(issue.reporter_token, await store.listIssues())
    : []

  const isResolved =
    issue.status === "RESOLVED" && issue.photos.resolution !== null

  const impact = impactFor(issue)
  const votes = {
    stillThere: issue.confirmations?.still_there ?? issue.upvotes,
    fixedNow: issue.confirmations?.fixed_now ?? 0,
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="text-sm font-semibold text-brand-primary hover:underline"
      >
        ← Back to map
      </Link>

      <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={issue.severity} />
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              issue.status === "RESOLVED"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : issue.status === "IN_PROGRESS"
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                  : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
            }`}
          >
            {statusText(issue.status)}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{issue.title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {issue.location.area}
          {issue.location.ward ? ` · ${issue.location.ward}` : ""}
        </p>
        <p className="mt-3 text-slate-700 dark:text-slate-200">{issue.description}</p>

        {/* Reporter line + earned badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Reported by {issue.reporter_display_name ?? "Anonymous Neighbour"}
          </span>
          <BadgePills badges={reporterBadges} />
        </div>
      </div>

      {/* For RESOLVED issues, the fix is the hero — slider first, above the fold. */}
      {isResolved && issue.photos.resolution && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            See the fix
          </h2>
          <ErrorBoundary>
            <BeforeAfterSlider
              beforeSrc={issue.photos.original}
              afterSrc={issue.photos.resolution}
              altBefore={`Before: ${issue.title}`}
              altAfter={`After: ${issue.title} — resolved`}
              resolutionVerdict={
                issue.resolution_verified ? "resolved" : toVerdict(null)
              }
            />
          </ErrorBoundary>
          {issue.resolution_reasoning && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {issue.resolution_reasoning}
            </p>
          )}
        </section>
      )}

      <div className="mt-6">
        <ErrorBoundary>
          <NearbyCitizensCard
            impact={impact}
            issueId={issue.id}
            votes={votes}
          />
        </ErrorBoundary>
      </div>

      {/* Status timeline (derived from the issue's own fields) */}
      <IssueTimeline issue={issue} />

      {/* Tier 2: the viewer's own badges (if they saved a nickname) */}
      <MyBadges />
    </main>
  )
}
