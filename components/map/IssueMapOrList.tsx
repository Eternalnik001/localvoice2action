"use client"

// ============================================================
// IssueMapOrList — the home view.
//
// Shows the INTERACTIVE Google Maps view immediately on the home page (no
// "click to explore" gate). Falls back to a grouped LIST when there is no Maps
// key or the SDK fails to load; a "Prefer a list?" toggle is always available.
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

const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 }

type Mode = "interactive" | "list"

export function IssueMapOrList({ issues }: IssueMapOrListProps) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Interactive map straight away when we have a key; list when we don't.
  const [mode, setMode] = useState<Mode>(mapsKey ? "interactive" : "list")
  const [mapFailed, setMapFailed] = useState(false)
  const mapRef = useRef<HTMLDivElement | null>(null)

  // Spin up the Google Maps JS SDK as soon as the interactive view mounts.
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

  // Interactive JS-SDK map — rendered immediately, no gate.
  return (
    <div>
      <div
        ref={mapRef}
        className="h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-100"
        aria-label="Interactive map of civic issues across Bengaluru"
      />
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
