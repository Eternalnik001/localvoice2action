"use client"

// ============================================================
// IssueMapOrList — the home view, cost-optimised.
//
// THREE render tiers:
//   1. STATIC MAP IMAGE on initial load (Static Maps API — cheap SKU, 28k/mo
//      free). Most visitors only look, so this avoids the expensive dynamic
//      JS-SDK "map load" SKU ~90% of the time.
//   2. INTERACTIVE JS SDK MAP only after the user clicks "explore" — the costly
//      SKU fires solely on intent.
//   3. LIST fallback when there is NO Maps key at all (truly ₹0-capable).
// ============================================================

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import { groupIssuesByArea } from "@/lib/data/areaGrouping"
import { SeverityBadge } from "@/components/SeverityBadge"
import type { Issue } from "@/lib/types"

export interface IssueMapOrListProps {
  issues: Issue[]
}

// Marker color by STATUS (open = red, in_progress = amber, resolved = green).
function statusHex(status: Issue["status"]): string {
  if (status === "RESOLVED") return "#10B981"
  if (status === "IN_PROGRESS") return "#F59E0B"
  return "#DC2626" // OPEN / ACKNOWLEDGED / CLOSED → red (active)
}

// Static Maps marker color (named/hex) — same status mapping.
function statusStatic(status: Issue["status"]): string {
  if (status === "RESOLVED") return "green"
  if (status === "IN_PROGRESS") return "orange"
  return "red"
}

const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 }

/** Build a Static Maps API URL with one marker per issue (cheap SKU). */
function buildStaticMapUrl(issues: Issue[], key: string): string {
  const params = new URLSearchParams({
    center: `${BENGALURU_CENTER.lat},${BENGALURU_CENTER.lng}`,
    zoom: "11",
    size: "640x360",
    scale: "2",
    key,
  })
  // Cap markers in the URL to keep it under length limits; group by status.
  const byStatus = new Map<string, string[]>()
  for (const i of issues.slice(0, 60)) {
    const color = statusStatic(i.status)
    const arr = byStatus.get(color) ?? []
    arr.push(`${i.location.lat.toFixed(4)},${i.location.lng.toFixed(4)}`)
    byStatus.set(color, arr)
  }
  let qs = params.toString()
  for (const [color, points] of byStatus) {
    qs += `&markers=${encodeURIComponent(`color:${color}|size:small|${points.join("|")}`)}`
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${qs}`
}

type Mode = "static" | "interactive" | "list"

// Below this viewport width the map is too cramped to be useful — default to
// the list (matches Tailwind's `sm` breakpoint). Users can still tap into the
// map via "Show map" if they want it.
const MOBILE_BREAKPOINT = 640

export function IssueMapOrList({ issues }: IssueMapOrListProps) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Static image first when we have a key; list when we don't.
  // (Server renders the static-first default; the effect below downgrades to
  // list on mobile after mount — avoids a hydration mismatch from reading
  // window during render.)
  const [mode, setMode] = useState<Mode>(mapsKey ? "static" : "list")
  const [isMobile, setIsMobile] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const mapRef = useRef<HTMLDivElement | null>(null)

  // On mobile, the map needs too much space — show the list by default.
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const apply = () => {
      setIsMobile(mq.matches)
      // Only auto-switch to list when entering mobile from the default static
      // view; never override an explicit "interactive" choice.
      if (mq.matches) setMode((m) => (m === "static" ? "list" : m))
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Only spin up the expensive JS SDK once the user opts into interactivity.
  useEffect(() => {
    if (!mapsKey || mode !== "interactive" || mapFailed) return
    let cancelled = false
    setOptions({ key: mapsKey, v: "weekly" })
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !mapRef.current) return
        const map = new Map(mapRef.current, {
          center: BENGALURU_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
        })
        for (const issue of issues) {
          const marker = new Marker({
            position: { lat: issue.location.lat, lng: issue.location.lng },
            map,
            title: issue.title,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: statusHex(issue.status),
              fillOpacity: issue.status === "RESOLVED" ? 0.85 : 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          })
          // Mini popup card: title, area, severity badge, View details link.
          const info = new google.maps.InfoWindow({
            content: `<div style="font-family:Inter,sans-serif;max-width:220px">
              <strong>${issue.title}</strong><br/>
              <span style="color:#64748b;font-size:12px">${issue.location.area}</span><br/>
              <span style="display:inline-block;margin:4px 0;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${statusHex(issue.status)};color:#fff">${issue.severity}</span><br/>
              <a href="/issues/${issue.id}" style="color:#1D4ED8;font-size:13px">View details →</a>
            </div>`,
          })
          marker.addListener("click", () => info.open(map, marker))
        }
      })
      .catch(() => {
        if (!cancelled) setMapFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [mapsKey, mode, mapFailed, issues])

  const groups = groupIssuesByArea(issues)

  // No key (or the interactive map failed) → reliable list.
  if (!mapsKey || mode === "list" || mapFailed) {
    return (
      <div>
        {mapsKey && !mapFailed && (
          <button
            onClick={() => setMode(isMobile ? "interactive" : "static")}
            className="mb-3 text-sm font-semibold text-brand-primary underline"
          >
            {isMobile ? "🗺️ Show map" : "← Back to map"}
          </button>
        )}
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.area}>
              <h2 className="mb-2 flex items-baseline gap-2 text-lg font-semibold text-slate-900">
                {group.area}
                <span className="text-sm font-normal text-slate-400">
                  {group.count} {group.count === 1 ? "issue" : "issues"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.issues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={issue.severity} />
                      {issue.status === "RESOLVED" && (
                        <span className="text-xs font-semibold text-emerald-600">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-medium text-slate-900">{issue.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {issue.confirmations?.still_there ?? issue.upvotes} neighbours
                      flagged this
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  // Interactive JS-SDK map (only after the user clicked "explore").
  if (mode === "interactive") {
    return (
      <div>
        <button
          onClick={() => setMode("static")}
          className="mb-3 text-sm font-semibold text-brand-primary underline"
        >
          ← Done exploring
        </button>
        <div
          ref={mapRef}
          className="h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-100"
          aria-label="Interactive map of civic issues across Bengaluru"
        />
      </div>
    )
  }

  // Default: STATIC map image (cheap SKU). Click to explore → JS SDK.
  const staticUrl = buildStaticMapUrl(issues, mapsKey)
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={staticUrl}
          alt="Map of civic issues across Bengaluru"
          className="h-[60vh] w-full object-cover"
          loading="lazy"
        />
        <button
          onClick={() => setMode("interactive")}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-brand-primary shadow-lg backdrop-blur-sm transition hover:bg-white"
        >
          🔍 Click to explore the map
        </button>
      </div>
      <button
        onClick={() => setMode("list")}
        className="mt-2 text-sm text-slate-500 underline"
      >
        Prefer a list?
      </button>
    </div>
  )
}

export default IssueMapOrList
