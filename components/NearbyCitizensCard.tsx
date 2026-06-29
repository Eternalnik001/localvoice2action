"use client"

// ============================================================
// NearbyCitizensCard — Feature 2 ("you're not alone") + community voting.
// Warm collective-impact framing, four affected-cohort pills, and the
// frictionless anonymous vote bar. Optimistic UI: counts update immediately
// and revert on error. alreadyVoted is treated as success (no error toast).
// ============================================================

import { useState } from "react"
import type { ImpactEstimate } from "@/lib/agents/impactEstimator"

export interface NearbyCitizensCardProps {
  impact: ImpactEstimate
  issueId: string
  votes: { stillThere: number; fixedNow: number }
}

type WireVote = "still_there" | "fixed_now"

interface ConfirmResponse {
  success?: boolean
  alreadyVoted?: boolean
  newCounts?: { stillThere: number; fixedNow: number }
  error?: string
}

export function NearbyCitizensCard({
  impact,
  issueId,
  votes,
}: NearbyCitizensCardProps) {
  const [counts, setCounts] = useState(votes)
  const [voted, setVoted] = useState(false)
  const [pending, setPending] = useState(false)

  const total = counts.stillThere + counts.fixedNow
  const fixedPct = total > 0 ? (counts.fixedNow / total) * 100 : 0
  const mostlyFixed = fixedPct > 60

  const breakdown: Array<{ label: string; value: number }> = [
    { label: "Residents", value: impact.residents },
    { label: "Commuters", value: impact.commuters },
    { label: "Businesses", value: impact.businesses },
    { label: "Delivery partners", value: impact.deliveryPartners },
  ]

  async function vote(wire: WireVote) {
    if (voted || pending) return
    setPending(true)

    // Optimistic update.
    const previous = counts
    const optimistic =
      wire === "still_there"
        ? { ...counts, stillThere: counts.stillThere + 1 }
        : { ...counts, fixedNow: counts.fixedNow + 1 }
    setCounts(optimistic)

    try {
      const res = await fetch("/api/confirm-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, vote: wire }),
      })
      const data = (await res.json()) as ConfirmResponse

      if (data.alreadyVoted) {
        // Already weighed in — graceful: keep the disabled "thanks" state,
        // but don't keep the optimistic +1 (they didn't actually add one now).
        setCounts(previous)
        setVoted(true)
        return
      }

      if (!res.ok || !data.success) {
        // Revert on error.
        setCounts(previous)
        return
      }

      if (data.newCounts) setCounts(data.newCounts)
      setVoted(true)
    } catch {
      setCounts(previous) // network error → revert
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      {/* 1. Warm tagline (18px, not a heading tag). */}
      <p className="text-[18px] font-semibold leading-snug text-slate-900">
        {impact.tagline}
      </p>

      {/* 2. Affected breakdown — 2 cols on mobile, 4 on sm+. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {breakdown.map((b) => (
          <div
            key={b.label}
            className="rounded-xl bg-slate-50 px-3 py-3 text-center ring-1 ring-slate-100"
          >
            <div className="text-xl font-bold text-brand-primary">
              {b.value}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{b.label}</div>
          </div>
        ))}
      </div>

      {/* 4. Progress: fixedNow as % of total. Amber→green only when mostly fixed. */}
      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              mostlyFixed
                ? "bg-gradient-to-r from-amber-400 to-emerald-500"
                : "bg-amber-400"
            }`}
            style={{ width: `${fixedPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {counts.fixedNow} of {total} neighbours say this is fixed
        </p>
      </div>

      {/* 3. Community vote bar. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => vote("still_there")}
          disabled={voted || pending}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Still there 👎 ({counts.stillThere})
        </button>
        <button
          type="button"
          onClick={() => vote("fixed_now")}
          disabled={voted || pending}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Fixed now 👍 ({counts.fixedNow})
        </button>
      </div>

      {voted && (
        <p className="mt-3 text-center text-sm text-slate-500">
          Thanks — you&apos;ve helped {total} neighbour{total === 1 ? "" : "s"} be
          heard.
        </p>
      )}
    </section>
  )
}

export default NearbyCitizensCard
