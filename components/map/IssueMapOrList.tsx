"use client"

// ============================================================
// IssueMapOrList — the home view.
//
// Shows the INTERACTIVE Google Maps view immediately on the home page (no
// "click to explore" gate). A "Pins / Heatmap" toggle flips between
// status-colored markers and a community-amplified heat overlay.
//
// NOTE: google.maps.visualization.HeatmapLayer was REMOVED in Maps JS v3.65
// (May 2026), so the heat view is rendered with core google.maps.Circle's —
// weighted (lib/maps/heatmap) translucent circles that intensify where they
// overlap. No deprecated API, no extra dependency.
//
// Falls back to a grouped LIST when there is no Maps key or the SDK fails to
// load; a "Prefer a list?" toggle is always available.
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

// Marker color by STATUS (open = red, in_progress = amber, resolved = green).
function statusHex(status: Issue["status"]): string {
  if (status === "RESOLVED") return "#10B981"
  if (status === "IN_PROGRESS") return "#F59E0B"
  return "#DC2626" // OPEN / ACKNOWLEDGED / CLOSED → red (active)
}

const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 }

type Mode = "interactive" | "list"
type MapView = "pins" | "heat"

export function IssueMapOrList({ issues }: IssueMapOrListProps) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Interactive map straight away when we have a key; list when we don't.
  const [mode, setMode] = useState<Mode>(mapsKey ? "interactive" : "list")
  const [mapView, setMapView] = useState<MapView>("pins")
  const [mapFailed, setMapFailed] = useState(false)

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const heatRef = useRef<google.maps.Circle[]>([])
  // Latest view, readable inside the async build effect without making it a dep.
  const mapViewRef = useRef(mapView)
  mapViewRef.current = mapView

  // Build the map + markers + heat circles once per (key/mode/issues). The view
  // toggle below only flips layer visibility, so pan/zoom is preserved.
  useEffect(() => {
    if (!mapsKey || mode !== "interactive" || mapFailed) return
    let cancelled = false
    setOptions({ key: mapsKey, v: "weekly" })
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !mapRef.current) return
        // Brand link color follows the theme (violet in dark, blue in light).
        const linkColor = document.documentElement.classList.contains("dark")
          ? "#8b5cf6"
          : "#1D4ED8"
        const map = new Map(mapRef.current, {
          center: BENGALURU_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
        })
        mapInstanceRef.current = map

        // --- Pins layer: status-colored, clickable markers ---
        const markers: google.maps.Marker[] = []
        for (const issue of issues) {
          const marker = new Marker({
            position: { lat: issue.location.lat, lng: issue.location.lng },
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
              <a href="/issues/${issue.id}" style="color:${linkColor};font-size:13px">View details →</a>
            </div>`,
          })
          marker.addListener("click", () => info.open(map, marker))
          markers.push(marker)
        }
        markersRef.current = markers

        // --- Heat layer: weighted translucent circles (overlap = hotter) ---
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
            radius: 220 + norm * 680, // metres — hotter spreads wider
            fillColor: color,
            fillOpacity: 0.3 + norm * 0.2,
            strokeOpacity: 0,
            clickable: false,
          })
        })
        heatRef.current = circles

        // Apply the current view (default: pins visible, heat hidden).
        const view = mapViewRef.current
        markers.forEach((m) => m.setMap(view === "pins" ? map : null))
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
    markersRef.current.forEach((m) => m.setMap(mapView === "pins" ? map : null))
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

  // Interactive JS-SDK map — rendered immediately, with a Pins/Heatmap toggle.
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
