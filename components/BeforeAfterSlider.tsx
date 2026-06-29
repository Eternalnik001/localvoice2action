"use client"

// ============================================================
// BeforeAfterSlider — Feature 1.
// Pure React + CSS (Tailwind), no external libraries. Two stacked images; a
// range input drives a clip on the "after" layer so dragging left→right
// reveals the fix. Mouse, touch, and keyboard all work (the native range
// input gives keyboard + a11y for free; touch is handled explicitly).
// ============================================================

import { useState } from "react"

export type ResolutionVerdict =
  | "resolved"
  | "partial"
  | "not_resolved"
  | "cant_tell"

export interface BeforeAfterSliderProps {
  beforeSrc: string
  afterSrc: string
  altBefore?: string
  altAfter?: string
  resolutionVerdict?: ResolutionVerdict
}

const VERDICT: Record<
  ResolutionVerdict,
  { label: string; className: string }
> = {
  resolved: {
    label: "✓ Verified fixed",
    className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300",
  },
  partial: {
    label: "~ Partially fixed",
    className: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
  },
  not_resolved: {
    label: "✗ Not yet fixed",
    className: "bg-red-100 text-red-700 ring-1 ring-red-300",
  },
  cant_tell: {
    label: "? Awaiting verification",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300",
  },
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  altBefore = "Before",
  altAfter = "After — resolved",
  resolutionVerdict,
}: BeforeAfterSliderProps) {
  // Percentage of the "after" image revealed from the left (0–100).
  const [pos, setPos] = useState(50)

  const verdict = resolutionVerdict ? VERDICT[resolutionVerdict] : null

  const setFromClientX = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, pct)))
  }

  return (
    <div className="w-full">
      {verdict && (
        <div className="mb-2">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${verdict.className}`}
          >
            {verdict.label}
          </span>
        </div>
      )}

      <div
        className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-slate-100"
        style={{ touchAction: "none" }}
        onTouchMove={(e) => {
          const touch = e.touches[0]
          if (touch) setFromClientX(touch.clientX, e.currentTarget)
        }}
      >
        {/* Base layer: BEFORE (always fully visible underneath). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt={altBefore}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Top layer: AFTER, clipped to the revealed width. */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterSrc}
            alt={altAfter}
            className="h-full w-full object-cover"
            draggable={false}
          />
          {/* Subtle success tint on the AFTER side. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-emerald-500/10" />
        </div>

        {/* Corner pills. */}
        <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          BEFORE
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-emerald-600/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          AFTER
        </span>

        {/* Divider line at the reveal position. */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-lg text-brand-primary shadow-lg">
            ⇆
          </div>
        </div>

        {/* The actual control: a transparent range input over the whole image.
            Gives mouse drag + full keyboard support + ARIA for free. */}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Before and after comparison slider"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
    </div>
  )
}

export default BeforeAfterSlider
