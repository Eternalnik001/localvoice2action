// ============================================================
// Ward + authority mapping for Bengaluru areas.
// Maps a resolved area name to its BBMP ward and the relevant civic authority
// contacts (BBMP / BWSSB / BESCOM). The routing agent (Agent 3) uses this so
// it can route ANY area — mapped areas get precise ward info; unmapped areas
// still route correctly to the parent authority with an explicit note.
// Never throws, never returns null.
// ============================================================

import type { IssueType } from "@/lib/types"

export type AuthorityName = "BBMP" | "BWSSB" | "BESCOM"

export interface AuthorityContact {
  name: AuthorityName
  department: string
  helpline: string
}

export interface WardInfo {
  area: string
  ward: string // e.g. "Ward 68" — or a note when unclear
  /** True when we matched a known area; false when falling back to central BBMP. */
  mapped: boolean
  /** Set when mapped is false — surfaced in the complaint ("Ward boundary unclear …"). */
  note?: string
}

// Which authority owns which issue type. (Sewage is modelled as WATER_LEAKAGE
// → BWSSB, consistent with the seed.)
const AUTHORITY_BY_TYPE: Record<IssueType, AuthorityContact> = {
  POTHOLE: { name: "BBMP", department: "Roads & Infrastructure", helpline: "1533" },
  DAMAGED_FOOTPATH: { name: "BBMP", department: "Roads & Infrastructure", helpline: "1533" },
  GARBAGE_OVERFLOW: { name: "BBMP", department: "Solid Waste Management", helpline: "1533" },
  ENCROACHMENT: { name: "BBMP", department: "Town Planning", helpline: "1533" },
  WATER_LEAKAGE: { name: "BWSSB", department: "Water Supply & Sewerage", helpline: "1916" },
  BROKEN_STREETLIGHT: { name: "BESCOM", department: "Street Lighting", helpline: "1912" },
  OTHER: { name: "BBMP", department: "General Grievances", helpline: "1533" },
  NOT_A_CIVIC_ISSUE: { name: "BBMP", department: "General Grievances", helpline: "1533" },
}

// Area → BBMP ward. Keys are matched case-insensitively and by prefix, so
// "Koramangala 4th Block" resolves via the "koramangala" entry.
const AREA_TO_WARD: Record<string, string> = {
  koramangala: "Ward 68",
  indiranagar: "Ward 80",
  whitefield: "Ward 84",
  "hsr layout": "Ward 174",
  marathahalli: "Ward 85",
  bellandur: "Ward 150",
  yelahanka: "Ward 3",
  rajajinagar: "Ward 99",
  malleshwaram: "Ward 45",
  "btm layout": "Ward 176",
  "electronic city": "Ward 198",
  jayanagar: "Ward 65",
  banashankari: "Ward 155",
  hebbal: "Ward 5",
}

/** Authority contact for an issue type (always resolves). */
export function authorityForType(issueType: IssueType): AuthorityContact {
  return AUTHORITY_BY_TYPE[issueType]
}

/**
 * Resolve ward info for an area name. Matches known areas case-insensitively /
 * by prefix; for anything unmapped, returns a central-BBMP fallback with a
 * clear note instead of failing.
 */
export function wardForArea(area: string): WardInfo {
  const key = area.trim().toLowerCase()
  for (const [name, ward] of Object.entries(AREA_TO_WARD)) {
    if (key === name || key.startsWith(name) || key.includes(name)) {
      return { area, ward, mapped: true }
    }
  }
  return {
    area,
    ward: "Central BBMP",
    mapped: false,
    note: "Ward boundary unclear — routed to central BBMP",
  }
}
