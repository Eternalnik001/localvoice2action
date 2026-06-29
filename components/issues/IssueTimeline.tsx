// ============================================================
// IssueTimeline — vertical status timeline.
// DERIVED from the issue's existing fields (created_at, authority,
// confirmations, status, resolved_at) — no separate stored timeline field, so
// it can never drift from the real issue state.
// ============================================================

import { shortDate } from "@/lib/format"
import type { Issue } from "@/lib/types"

export interface IssueTimelineProps {
  issue: Issue
}

interface TimelineEvent {
  label: string
  detail: string
  date: Date | null
  done: boolean
}

function buildTimeline(issue: Issue): TimelineEvent[] {
  const created = issue.created_at
  const stillThere = issue.confirmations?.still_there ?? issue.upvotes
  const isResolved = issue.status === "RESOLVED"
  const acknowledged =
    issue.status === "ACKNOWLEDGED" ||
    issue.status === "IN_PROGRESS" ||
    isResolved

  // Derived approximate timestamps (offset from created_at) for the demo —
  // real events would be stamped as they happen once persistence is added.
  const hour = 60 * 60 * 1000
  const triagedAt = new Date(created.getTime() + hour)
  const confirmedAt = new Date(created.getTime() + 6 * hour)
  const notifiedAt = new Date(created.getTime() + 8 * hour)

  return [
    {
      label: "Reported",
      detail: "by a citizen",
      date: created,
      done: true,
    },
    {
      label: "AI Triaged",
      detail: `Routed to ${issue.authority.name}${
        issue.authority.department ? ` · ${issue.authority.department}` : ""
      }`,
      date: triagedAt,
      done: true,
    },
    {
      label: "Community confirmed",
      detail:
        stillThere > 0
          ? `${stillThere} neighbour${stillThere === 1 ? "" : "s"} confirmed this`
          : "Awaiting community confirmations",
      date: stillThere > 0 ? confirmedAt : null,
      done: stillThere > 0,
    },
    {
      label: "Authority notified",
      detail: acknowledged
        ? `${issue.authority.name} acknowledged the report`
        : `Pending — escalates in ${issue.authority.escalation_days} days`,
      date: acknowledged ? notifiedAt : null,
      done: acknowledged,
    },
    {
      label: "Resolved",
      detail: isResolved
        ? issue.resolution_reasoning ?? "Verified fixed"
        : "Not yet resolved",
      date: issue.resolved_at,
      done: isResolved,
    },
  ]
}

export function IssueTimeline({ issue }: IssueTimelineProps) {
  const events = buildTimeline(issue)
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Status</h2>
      <ol className="relative space-y-5 border-l-2 border-slate-200 pl-5">
        {events.map((e) => (
          <li key={e.label} className="relative">
            {/* Dot */}
            <span
              className={`absolute -left-[27px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-white ${
                e.done ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              {e.done && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`font-medium ${e.done ? "text-slate-900" : "text-slate-400"}`}
              >
                {e.label}
              </span>
              {e.date && (
                <span className="text-xs text-slate-400">
                  {shortDate(e.date)}
                </span>
              )}
            </div>
            <p className={`text-sm ${e.done ? "text-slate-600" : "text-slate-400"}`}>
              {e.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default IssueTimeline
