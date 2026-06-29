"use client"

// ============================================================
// Report flow (Phase 2D). Upload a photo → /api/analyze-issue runs the
// vision → dedup → routing → impact pipeline (2–4s). Then:
//   - action 'merge'  → warm amber "neighbour spotted this too" card +
//                        optional "add my photo to make it louder" (Agent 4).
//   - action 'create' → new-issue summary card with Agent 6's impact tagline.
//   - outsideBengaluru → friendly "we're starting here" message.
// Tone rule: never "Error/Failed/Invalid/Rejected" — warm, neighbourly copy.
// ============================================================

import { useState } from "react"
import Link from "next/link"
import { VoiceInputButton } from "@/components/VoiceInputButton"
import { NicknamePrompt } from "@/components/NicknamePrompt"
import type { Issue } from "@/lib/types"
import type { ImpactEstimate } from "@/lib/agents/impactEstimator"

// Default demo coords — Koramangala (near the seeded potholes → triggers merge).
const DEFAULT_LAT = 12.9352
const DEFAULT_LNG = 77.6245

interface AnalyzeResponse {
  action?: "merge" | "create"
  duplicateId?: string
  friendlyMessage?: string
  duplicatePhotoUrl?: string | null
  duplicateTitle?: string | null
  impact?: ImpactEstimate
  issue?: Issue
  badges?: { id: string; label: string; emoji: string }[]
  outsideBengaluru?: boolean
  error?: string
}

type Phase =
  | { kind: "idle" }
  | { kind: "analysing" }
  | { kind: "merge"; data: AnalyzeResponse }
  | { kind: "create"; data: AnalyzeResponse }
  | { kind: "outside" }
  | { kind: "retry"; message: string }

export default function ReportPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [description, setDescription] = useState("")

  async function handlePhoto(file: File) {
    setPreviewUrl(URL.createObjectURL(file))
    setPhase({ kind: "analysing" })

    const form = new FormData()
    form.append("photo", file)
    form.append("lat", String(DEFAULT_LAT))
    form.append("lng", String(DEFAULT_LNG))
    // Optional spoken/typed context — enriches the report; vision still leads.
    if (description.trim()) form.append("note", description.trim())

    try {
      const res = await fetch("/api/analyze-issue", {
        method: "POST",
        body: form,
      })
      const data = (await res.json()) as AnalyzeResponse

      if (data.outsideBengaluru) {
        setPhase({ kind: "outside" })
        return
      }
      // 400 from vision = "couldn't classify" — warm retry, never "error".
      if (!res.ok || data.error) {
        setPhase({
          kind: "retry",
          message:
            "Hmm, let's try that again — a clearer, closer photo of the issue helps us read it.",
        })
        return
      }
      if (data.action === "merge") {
        setPhase({ kind: "merge", data })
      } else if (data.action === "create") {
        setPhase({ kind: "create", data })
      } else {
        setPhase({
          kind: "retry",
          message: "One moment — that didn't go through. Want to try again?",
        })
      }
    } catch {
      setPhase({
        kind: "retry",
        message: "One moment — we couldn't reach the server. Try again?",
      })
    }
  }

  function reset() {
    setPreviewUrl(null)
    setDescription("")
    setPhase({ kind: "idle" })
  }

  // Voice transcript APPENDS to the textarea (space-separated), never replaces.
  function appendTranscript(text: string) {
    setDescription((prev) => (prev ? `${prev} ${text}` : text))
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Report an issue</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Snap a photo — we&apos;ll handle the diagnosis, the paperwork, and the
        right department.
      </p>

      {/* Upload (idle / retry) */}
      {(phase.kind === "idle" || phase.kind === "retry") && (
        <div className="mt-6">
          {phase.kind === "retry" && (
            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60">
              {phase.message}
            </div>
          )}

          {/* Optional description with voice input (the "LocalVoice" feature) */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="report-description"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Add a note <span className="text-slate-400 dark:text-slate-500">(optional)</span>
              </label>
              <VoiceInputButton onTranscript={appendTranscript} language="en-IN" />
            </div>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the issue, or tap Speak to say it aloud…"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-base sm:text-sm text-slate-800 dark:text-slate-100 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white dark:bg-slate-900 px-6 py-12 text-center transition hover:border-brand-primary">
            <span className="text-4xl">📸</span>
            <span className="mt-2 font-semibold text-slate-700 dark:text-slate-200">
              Tap to add a photo
            </span>
            <span className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              A clear, close shot of the issue works best
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handlePhoto(f)
              }}
            />
          </label>
        </div>
      )}

      {/* Loading skeleton */}
      {phase.kind === "analysing" && (
        <div className="mt-6">
          <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Your report"
                className="h-56 w-full object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 animate-pulse bg-slate-900/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow">
                AI is analysing your report…
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Outside Bengaluru — friendly, not an error */}
      {phase.kind === "outside" && (
        <div className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-5 ring-1 ring-amber-200 dark:ring-amber-800/60">
          <p className="font-semibold text-amber-900 dark:text-amber-300">
            Looks like you&apos;re outside Bengaluru 🛵
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            We&apos;re starting here and expanding soon! Thanks for wanting to
            help your city.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Okay
          </button>
        </div>
      )}

      {/* MERGE — warm "neighbour spotted this too" */}
      {phase.kind === "merge" && (
        <MergeCard data={phase.data} yoursPreview={previewUrl} onDone={reset} />
      )}

      {/* CREATE — new issue summary */}
      {phase.kind === "create" && phase.data.issue && (
        <div className="mt-6 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            ✅ Your voice is on the map!
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            {phase.data.issue.title}
          </h2>
          {phase.data.impact && (
            <p className="mt-2 text-[15px] text-slate-700 dark:text-slate-200">
              {phase.data.impact.tagline}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Routed to {phase.data.issue.authority.name} ·{" "}
            {phase.data.issue.authority.department}
          </p>
          {/* Gamification: badge earned this report (warm, inline) */}
          {phase.data.badges && phase.data.badges.length > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60">
              You&apos;ve earned the {phase.data.badges[0]!.emoji}{" "}
              {phase.data.badges[0]!.label} badge for{" "}
              {phase.data.issue.location.area}!
            </p>
          )}
          {/* Tier 2 soft identity — optional, inline, never blocks */}
          <NicknamePrompt />
          <Link
            href={`/issues/${phase.data.issue.id}`}
            className="mt-4 inline-block rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          >
            View issue →
          </Link>
        </div>
      )}
    </main>
  )
}

// --- Merge card: never blocks; invites adding a confirming photo ---
function MergeCard({
  data,
  yoursPreview,
  onDone,
}: {
  data: AnalyzeResponse
  yoursPreview: string | null
  onDone: () => void
}) {
  const [status, setStatus] = useState<
    "idle" | "confirming" | "confirmed" | "retry"
  >("idle")

  async function addPhoto(file: File) {
    if (!data.duplicateId) return
    setStatus("confirming")
    const form = new FormData()
    form.append("issueId", data.duplicateId)
    form.append("photo", file)
    try {
      const res = await fetch("/api/add-confirmation", {
        method: "POST",
        body: form,
      })
      const body = (await res.json()) as { confirmed?: boolean }
      setStatus(body.confirmed ? "confirmed" : "retry")
    } catch {
      setStatus("retry")
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-5 ring-1 ring-amber-200 dark:ring-amber-800/60">
      <p className="font-semibold text-amber-900 dark:text-amber-300">
        🤝 A neighbour spotted this too
      </p>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
        {data.friendlyMessage ??
          "This looks like the same issue someone reported nearby."}
      </p>

      {/* Photo pair */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Thumb label="Yours" src={yoursPreview} />
        <Thumb label="Already reported" src={data.duplicatePhotoUrl ?? null} />
      </div>

      {status === "confirmed" ? (
        <div className="mt-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <p>Your report has been added — the more voices, the harder to ignore.</p>
          <p className="mt-1">🔍 Truth Checker badge unlocked!</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
            Want to add your photo to make this report louder?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label
              className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                status === "confirming"
                  ? "cursor-not-allowed bg-amber-300"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {status === "confirming" ? "Almost there…" : "Add my photo 📣"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={status === "confirming"}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) addPhoto(f)
                }}
              />
            </label>
            {data.duplicateId && (
              <Link
                href={`/issues/${data.duplicateId}`}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-amber-900 dark:text-amber-300 underline"
              >
                View the existing report →
              </Link>
            )}
          </div>
          {status === "retry" && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Hmm, let&apos;s try that again — a photo of the same spot helps us
              match it.
            </p>
          )}
        </div>
      )}

      <button
        onClick={onDone}
        className="mt-4 text-xs text-amber-700 dark:text-amber-300 underline"
      >
        Done
      </button>
    </div>
  )
}

function Thumb({ label, src }: { label: string; src: string | null }) {
  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-700">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" />
        )}
      </div>
      <p className="mt-1 text-center text-xs font-medium text-amber-900 dark:text-amber-300">
        {label}
      </p>
    </div>
  )
}
