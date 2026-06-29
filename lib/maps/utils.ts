// ============================================================
// Geo helpers — pure functions.
// Single source of truth for distance math, shared by the in-memory data
// store's nearby query and Agent 2 (dedup). Do not duplicate the formula.
// ============================================================

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_METERS = 6_371_000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Great-circle distance between two points, in metres (Haversine).
 * Used for the "reported N metres away" dedup copy, so the result is the
 * real distance — round at the display layer, not here.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}
