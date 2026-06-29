// ============================================================
// Reverse geocoding — resolve any coordinate to a Bengaluru area name.
//
// Strategy (each step degrades gracefully; never returns null/undefined):
//   1. Local bounding-box lookup over the major areas (instant, offline,
//      drift-tolerant). On boundary overlap, the NEAREST area CENTROID wins.
//   2. If no box matches but the point is still inside Bengaluru, optionally
//      call the Google Geocoding API (server-side). NOTE: the only Maps key in
//      this project is NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, which is referrer-
//      restricted for the browser JS API — a server geocoding fetch with it
//      will usually be rejected, so this step is best-effort. A dedicated
//      server geocoding key (GOOGLE_GEOCODING_API_KEY) is the production fix.
//   3. Fall back to "Bengaluru".
// Coordinates outside the Bengaluru metro bounds are reported via
// isInsideBengaluru() so the route can short-circuit with a friendly message.
// ============================================================

import { haversineMeters } from "@/lib/maps/utils"

export interface AreaBox {
  area: string
  /** Centroid — used to break boundary ties (Step 7: pick the closer centroid). */
  centroid: { lat: number; lng: number }
  /** Inclusive bounding box. */
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

// Greater Bengaluru envelope (generous, covers the metro). Anything outside
// this is treated as "not Bengaluru".
const BENGALURU_BOUNDS = {
  minLat: 12.7,
  maxLat: 13.25,
  minLng: 77.35,
  maxLng: 77.85,
}

// Bounding boxes for the major areas. Boxes are ~±0.02° (~2km) around each
// centroid, which comfortably absorbs ±50m mobile GPS drift (Step 7).
function box(area: string, lat: number, lng: number, pad = 0.02): AreaBox {
  return {
    area,
    centroid: { lat, lng },
    minLat: lat - pad,
    maxLat: lat + pad,
    minLng: lng - pad,
    maxLng: lng + pad,
  }
}

const AREA_BOXES: AreaBox[] = [
  box("Koramangala", 12.9352, 77.6245),
  box("Indiranagar", 12.9719, 77.6412),
  box("Whitefield", 12.9698, 77.7499),
  box("HSR Layout", 12.9116, 77.6389),
  box("Marathahalli", 12.9591, 77.6974),
  box("Bellandur", 12.926, 77.6762),
  box("Yelahanka", 13.1007, 77.5963),
  box("Rajajinagar", 12.9907, 77.553),
  box("Malleshwaram", 13.0035, 77.571),
  box("BTM Layout", 12.9166, 77.6101),
  box("Electronic City", 12.8399, 77.677),
  box("Jayanagar", 12.9308, 77.5831),
  box("Banashankari", 12.9255, 77.5468),
  box("Hebbal", 13.0456, 77.6203),
  box("Jayanagar", 12.9299, 77.583),
]

// In-memory cache, keyed by rounded coords (~11m grid) so near-identical GPS
// pings hit the cache and we never re-call the geocoding API for the same spot.
const cache = new Map<string, string>()
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/** Is the coordinate within the greater-Bengaluru envelope? */
export function isInsideBengaluru(lat: number, lng: number): boolean {
  return (
    lat >= BENGALURU_BOUNDS.minLat &&
    lat <= BENGALURU_BOUNDS.maxLat &&
    lng >= BENGALURU_BOUNDS.minLng &&
    lng <= BENGALURU_BOUNDS.maxLng
  )
}

/** All boxes whose rectangle contains the point. */
function boxesContaining(lat: number, lng: number): AreaBox[] {
  return AREA_BOXES.filter(
    (b) =>
      lat >= b.minLat &&
      lat <= b.maxLat &&
      lng >= b.minLng &&
      lng <= b.maxLng
  )
}

/** Bounding-box match; on overlap, the nearest centroid wins. null if none. */
function matchByBox(lat: number, lng: number): string | null {
  const hits = boxesContaining(lat, lng)
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]!.area
  // Boundary overlap → pick the closer centroid (Step 7).
  let best = hits[0]!
  let bestD = haversineMeters({ lat, lng }, best.centroid)
  for (const b of hits.slice(1)) {
    const d = haversineMeters({ lat, lng }, b.centroid)
    if (d < bestD) {
      best = b
      bestD = d
    }
  }
  return best.area
}

/** Best-effort Google Geocoding (server-side). Returns null on any failure. */
async function geocodeArea(lat: number, lng: number): Promise<string | null> {
  const key =
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&result_type=sublocality|neighborhood`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      status?: string
      results?: Array<{
        address_components?: Array<{ long_name: string; types: string[] }>
      }>
    }
    if (data.status !== "OK") return null
    for (const result of data.results ?? []) {
      for (const comp of result.address_components ?? []) {
        if (
          comp.types.includes("sublocality") ||
          comp.types.includes("neighborhood")
        ) {
          return comp.long_name
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolve a coordinate to an area name. Never returns null/undefined.
 * Returns "Bengaluru" as the final fallback. (Callers should check
 * isInsideBengaluru() first to handle out-of-city coordinates.)
 */
export async function getAreaFromCoords(
  lat: number,
  lng: number
): Promise<string> {
  const key = cacheKey(lat, lng)
  const cached = cache.get(key)
  if (cached) return cached

  // 1. Local bounding box (instant, offline, drift-tolerant).
  const byBox = matchByBox(lat, lng)
  if (byBox) {
    cache.set(key, byBox)
    return byBox
  }

  // 2. Geocoding (best-effort) — only if still inside Bengaluru.
  if (isInsideBengaluru(lat, lng)) {
    const geo = await geocodeArea(lat, lng)
    if (geo) {
      cache.set(key, geo)
      return geo
    }
  }

  // 3. Fallback.
  cache.set(key, "Bengaluru")
  return "Bengaluru"
}
