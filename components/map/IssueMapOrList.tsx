"use client"

// ============================================================
// IssueMapOrList — the home view.
//
// Interactive Google Map (no "click to explore" gate) with a Pins/Heatmap
// toggle. PINS use a state machine via AdvancedMarkerElement custom content:
//   • Active        → severity-coloured dot (CRITICAL pulses)
//   • Community Fixed→ grey dot + ✅ (fixed_now > still_there, not yet verified)
//   • Authority Resolved → green dot + ✅ (RESOLVED); fades after 7 days
// HEAT uses weighted google.maps.Circle's (HeatmapLayer was removed in Maps JS
// v3.65). Falls back to a grouped LIST with no Maps key / SDK failure.
// ============================================================

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import { groupIssuesByArea } from "@/lib/data/areaGrouping"
import { computeHeatmapWeight } from "@/lib/maps/heatmap"
import { SeverityBadge } from "@/components/SeverityBadge"
import type { Issue } from "@/lib/types"

export interface IssueMapOrListProps {
  issues: Issue[]
}

// Active-pin color by SEVERITY (critical red / high orange / medium amber / low lime).
function severityHex(severity: Issue["severity"]): string {
  if (severity === "CRITICAL") return "#DC2626"
  if (severity === "HIGH") return "#EA580C"
  if (severity === "MEDIUM") return "#D97706"
  return "#65A30D" // LOW
}

type PinVisual = { color: string; check: boolean; pulse: boolean; faded: boolean }

// Pin state machine: authority-resolved → community-fixed → active.
function pinVisual(issue: Issue, nowMs: number): PinVisual {
  const stillThere = issue.confirmations?.still_there ?? issue.upvotes
  const fixedNow = issue.confirmations?.fixed_now ?? 0

  if (issue.status === "RESOLVED") {
    const ageDays = issue.resolved_at
      ? (nowMs - issue.resolved_at.getTime()) / 86_400_000
      : 0
    return { color: "#10B981", check: true, pulse: false, faded: ageDays > 7 }
  }
  if (
    issue.verification_status === "COMMUNITY_VERIFIED" ||
    (fixedNow > stillThere && fixedNow > 0)
  ) {
    return { color: "#9CA3AF", check: true, pulse: false, faded: false } // community fixed (grey)
  }
  return {
    color: severityHex(issue.severity),
    check: false,
    pulse: issue.severity === "CRITICAL",
    faded: false,
  }
}

// Build the DOM content for an AdvancedMarkerElement (Tailwind classes apply).
function buildPin(v: PinVisual): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "relative grid place-items-center"
  el.style.opacity = v.faded ? "0.35" : "1"
  el.style.cursor = "pointer"

  if (v.pulse) {
    const ring = document.createElement("span")
    ring.className = "absolute inline-flex h-5 w-5 rounded-full animate-pulse-ring"
    ring.style.backgroundColor = v.color
    el.appendChild(ring)
  }

  const dot = document.createElement("span")
  dot.className = "relative inline-block h-3.5 w-3.5 rounded-full"
  dot.style.backgroundColor = v.color
  dot.style.border = "2px solid #fff"
  dot.style.boxShadow = "0 1px 3px rgba(0,0,0,.4)"
  el.appendChild(dot)

  if (v.check) {
    const chk = document.createElement("span")
    chk.textContent = "✅"
    chk.className = "absolute -right-2 -top-2 text-[10px]"
    el.appendChild(chk)
  }
  return el
}

const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 }

type Mode = "interactive" | "list"
type MapView = "pins" | "heat"

export function IssueMapOrList({ issues }: IssueMapOrListProps) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [mode, setMode] = useState<Mode>(mapsKey ? "interactive" : "list")
  const [mapView, setMapView] = useState<MapView>("pins")
  const [mapFailed, setMapFailed] = useState(false)

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const heatRef = useRef<google.maps.Circle[]>([])
  const mapViewRef = useRef(mapView)
  mapViewRef.current = mapView

  // Build the map + pins + heat circles once per (key/mode/issues). The view
  // toggle below only flips layer visibility, so pan/zoom is preserved.
  useEffect(() => {
    if (!mapsKey || mode !== "interactive" || mapFailed) return
    let cancelled = false
    setOptions({ key: mapsKey, v: "weekly" })
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map, InfoWindow }, { AdvancedMarkerElement }]) => {
        if (cancelled || !mapRef.current) return
        const linkColor = document.documentElement.classList.contains("dark")
          ? "#8b5cf6"
          : "#1D4ED8"
        const map = new Map(mapRef.current, {
          center: BENGALURU_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          // AdvancedMarkerElement requires a mapId; DEMO_MAP_ID works out of the
          // box, or set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID to a real cloud map style.
          mapId:
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        })
        mapInstanceRef.current = map
        const nowMs = Date.now()

        // --- Pins layer (state-machine markers) ---
        const markers = issues.map((issue) => {
          const marker = new AdvancedMarkerElement({
            position: { lat: issue.location.lat, lng: issue.location.lng },
            title: issue.title,
            content: buildPin(pinVisual(issue, nowMs)),
          })
          const info = new InfoWindow({
            content: `<div style="font-family:Inter,sans-serif;max-width:220px">
              <strong>${issue.title}</strong><br/>
              <span style="color:#64748b;font-size:12px">${issue.location.area}</span><br/>
              <span style="display:inline-block;margin:4px 0;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${severityHex(issue.severity)};color:#fff">${issue.severity}</span><br/>
              <a href="/issues/${issue.id}" style="color:${linkColor};font-size:13px">View details →</a>
            </div>`,
          })
          marker.content!.addEventListener("click", () =>
            info.open({ anchor: marker, map })
          )
          return marker
        })
        markersRef.current = markers

        // --- Heat layer (weighted translucent circles, overlap = hotter) ---
        const weights = issues.map(
          (i) =>
            i.heatmap_weight ??
            computeHeatmapWeight({
              severity: i.severity,
              still_there: i.confirmations?.still_there ?? i.upvotes,
              fixed_now: i.confirmations?.fixed_now ?? 0,
              created_at: new Date(i.created_at),
            })
        )
        const maxW = Math.max(1, ...weights)
        const circles = issues.map((issue, idx) => {
          const norm = weights[idx]! / maxW
          const color =
            norm < 0.34 ? "#facc15" : norm < 0.67 ? "#fb923c" : "#ef4444"
          return new google.maps.Circle({
            center: { lat: issue.location.lat, lng: issue.location.lng },
            radius: 220 + norm * 680,
            fillColor: color,
            fillOpacity: 0.3 + norm * 0.2,
            strokeOpacity: 0,
            clickable: false,
          })
        })
        heatRef.current = circles

        // Apply the current view (default: pins visible, heat hidden).
        const view = mapViewRef.current
        markers.forEach((m) => (m.map = view === "pins" ? map : null))
        circles.forEach((c) => c.setMap(view === "heat" ? map : null))
      })
      .catch(() => {
        if (!cancelled) setMapFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [mapsKey, mode, mapFailed, issues])

  // Toggle layer visibility when the view changes (no map rebuild).
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach((m) => (m.map = mapView === "pins" ? map : null))
    heatRef.current.forEach((c) => c.setMap(mapView === "heat" ? map : null))
  }, [mapView])

  const groups = groupIssuesByArea(issues)

  // No key, explicit list choice, or the interactive map failed → reliable list.
  if (!mapsKey || mode === "list" || mapFailed) {
    return (
      <div>
        {mapsKey && !mapFailed && (
          <button
            onClick={() => setMode("interactive")}
            className="mb-3 text-sm font-semibold text-brand-primary underline"
          >
            🗺️ Show map
          </button>
        )}
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.area}>
              <h2 className="mb-2 flex items-baseline gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {group.area}
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                  {group.count} {group.count === 1 ? "issue" : "issues"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.issues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="block rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition hover:ring-brand-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={issue.severity} />
                      {issue.status === "RESOLVED" && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{issue.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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

  // Interactive map — Pins/Heatmap toggle.
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1.5 transition ${
      active
        ? "bg-brand-primary text-white"
        : "text-slate-600 dark:text-slate-300"
    }`

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div
          role="group"
          aria-label="Map view"
          className="inline-flex rounded-full bg-white p-0.5 text-xs font-semibold ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <button
            type="button"
            onClick={() => setMapView("pins")}
            aria-pressed={mapView === "pins"}
            className={tab(mapView === "pins")}
          >
            📍 Pins
          </button>
          <button
            type="button"
            onClick={() => setMapView("heat")}
            aria-pressed={mapView === "heat"}
            className={tab(mapView === "heat")}
          >
            🔥 Heatmap
          </button>
        </div>
      </div>

      <div
        ref={mapRef}
        className="h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800"
        aria-label="Interactive map of civic issues across Bengaluru"
      />
      <button
        onClick={() => setMode("list")}
        className="mt-2 text-sm text-slate-500 dark:text-slate-400 underline"
      >
        Prefer a list?
      </button>
    </div>
  )
}

export default IssueMapOrList
