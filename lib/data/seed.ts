// ============================================================
// Bengaluru seed data for the in-memory demo store.
// Subset of the spec's 15 issues, plus the two arrangements the demo needs:
//   1. One RESOLVED issue with original + resolution photos + Agent-5-style
//      reasoning, so the Before/After slider renders on first load.
//   2. Two OPEN potholes ~20m apart in Koramangala, so the friendly dedup
//      flow triggers deterministically when reporting near them.
// Photos use Unsplash source URLs (civic/street imagery) for the demo.
// ============================================================

import type { Issue } from "@/lib/types"

// Stable demo timestamps (no Date.now() at module load — keeps it deterministic).
const DAY = 86_400_000
const NOW = new Date("2026-06-22T10:00:00+05:30")
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY)

// Generic civic photos (pothole/water/streetlight/garbage). Swappable later.
const PHOTO = {
  // Real before/after photos, served statically from /public/issue-photos.
  // (Other issue types still use stock imagery until real photos exist.)
  pothole: "/issue-photos/Before_pothole.png",
  potholeFixed: "/issue-photos/After_pothole.png",
  water:
    "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=70",
  streetlight:
    "https://images.unsplash.com/photo-1542013936693-884638332954?w=800&q=70",
  garbage: "/issue-photos/Before_garbage.png",
  garbageFixed: "/issue-photos/After_garbage.png",
  footpath:
    "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?w=800&q=70",
  // "sewage" is not a distinct IssueType in this codebase — sewage overflow is
  // modelled as WATER_LEAKAGE (BWSSB jurisdiction). Reuse the water photo.
} as const

interface SeedSpec {
  id: string
  title: string
  description: string
  issue_type: Issue["issue_type"]
  severity: Issue["severity"]
  status: Issue["status"]
  lat: number
  lng: number
  area: string
  ward: string
  address: string
  still_there: number
  fixed_now: number
  createdDaysAgo: number
  photo: string
  reporter_display_name?: string
  /** Anonymous reporter token — shared across a reporter's issues to earn badges. */
  reporter_token?: string
  // Resolution fields (only for the RESOLVED demo issue)
  resolutionPhoto?: string
  resolution_reasoning?: string
}

const SPECS: SeedSpec[] = [
  // --- The RESOLVED issue (drives the Before/After slider) ---
  {
    id: "blr-jaya-pothole-resolved",
    title: "Deep pothole at Jayanagar 4th Block junction",
    description: "Deep pothole 2ft wide at main junction near the market",
    issue_type: "POTHOLE",
    severity: "CRITICAL",
    status: "RESOLVED",
    lat: 12.9308,
    lng: 77.5831,
    area: "Jayanagar 4th Block",
    ward: "Ward 65",
    address: "4th Block Main Rd, Jayanagar, Bengaluru",
    still_there: 12,
    fixed_now: 47,
    createdDaysAgo: 9,
    photo: PHOTO.pothole,
    resolutionPhoto: PHOTO.potholeFixed,
    resolution_reasoning:
      "The pothole has been filled and the road surface is level and intact.",
  },

  // --- Two OPEN potholes ~20m apart in Koramangala (drives dedup) ---
  {
    reporter_token: "seed-reporter-asha",
    id: "blr-kora-pothole-a",
    title: "Large pothole near Sony World Signal",
    description: "Large pothole forming near Sony World Signal, 4th Block",
    issue_type: "POTHOLE",
    severity: "HIGH",
    status: "OPEN",
    lat: 12.9352,
    lng: 77.6245,
    area: "Koramangala 4th Block",
    ward: "Ward 68",
    address: "80 Feet Rd, Koramangala 4th Block, Bengaluru",
    still_there: 23,
    fixed_now: 2,
    createdDaysAgo: 5,
    photo: PHOTO.pothole,
    reporter_display_name: "A neighbour in Koramangala",
  },
  {
    // ~20m NE of pothole-a — same type, so a new report here is flagged a likely dup.
    reporter_token: "seed-reporter-asha",
    id: "blr-kora-pothole-b",
    title: "Pothole widening on the service road",
    description: "Second pothole widening just up the road from the signal",
    issue_type: "POTHOLE",
    severity: "MEDIUM",
    status: "OPEN",
    lat: 12.9353,
    lng: 77.62468,
    area: "Koramangala 4th Block",
    ward: "Ward 68",
    address: "80 Feet Rd service lane, Koramangala 4th Block, Bengaluru",
    still_there: 7,
    fixed_now: 1,
    createdDaysAgo: 2,
    photo: PHOTO.pothole,
    reporter_display_name: "A neighbour in Koramangala",
  },

  // --- Variety across the city ---
  {
    id: "blr-hsr-water",
    title: "Underground pipeline burst, road flooding",
    description: "Underground pipeline burst flooding the road in HSR Sector 2",
    issue_type: "WATER_LEAKAGE",
    severity: "CRITICAL",
    status: "ACKNOWLEDGED",
    lat: 12.9116,
    lng: 77.6389,
    area: "HSR Layout Sector 2",
    ward: "Ward 57",
    address: "Sector 2, HSR Layout, Bengaluru",
    still_there: 41,
    fixed_now: 3,
    createdDaysAgo: 3,
    photo: PHOTO.water,
    reporter_display_name: "A neighbour in HSR Layout",
  },
  {
    id: "blr-indira-streetlight",
    title: "Three streetlights non-functional on 100ft Road",
    description: "Three consecutive streetlights non-functional after 8pm",
    issue_type: "BROKEN_STREETLIGHT",
    severity: "MEDIUM",
    status: "OPEN",
    lat: 12.9784,
    lng: 77.6408,
    area: "Indiranagar",
    ward: "Ward 80",
    address: "100 Feet Rd, Indiranagar, Bengaluru",
    still_there: 11,
    fixed_now: 1,
    createdDaysAgo: 6,
    photo: PHOTO.streetlight,
    reporter_display_name: "A neighbour in Indiranagar",
  },
  {
    id: "blr-whitefield-garbage",
    title: "Municipal bin overflowing at Hope Farm Junction",
    description: "Municipal bin overflowing for 4 days near Hope Farm Junction",
    issue_type: "GARBAGE_OVERFLOW",
    severity: "HIGH",
    status: "IN_PROGRESS",
    lat: 12.9698,
    lng: 77.7499,
    area: "Whitefield",
    ward: "Ward 84",
    address: "Hope Farm Junction, Whitefield, Bengaluru",
    still_there: 18,
    fixed_now: 4,
    createdDaysAgo: 4,
    photo: PHOTO.garbage,
    reporter_display_name: "A neighbour in Whitefield",
  },

  // ============================================================
  // City-wide coverage — all major Bengaluru areas, varied types + statuses.
  // Coordinates verified to fall inside each named locality.
  // ============================================================

  // --- 2nd RESOLVED issue (slider demo beyond Jayanagar) ---
  {
    id: "blr-whitefield-garbage-resolved",
    title: "Garbage black-spot cleared near Whitefield ITPL",
    description: "Chronic garbage dumping on the service road near ITPL Main Rd",
    issue_type: "GARBAGE_OVERFLOW",
    severity: "HIGH",
    status: "RESOLVED",
    lat: 12.9852,
    lng: 77.7367,
    area: "Whitefield",
    ward: "Ward 84",
    address: "ITPL Main Rd service lane, Whitefield, Bengaluru",
    still_there: 6,
    fixed_now: 38,
    createdDaysAgo: 11,
    photo: PHOTO.garbage,
    resolutionPhoto: PHOTO.garbageFixed,
    resolution_reasoning:
      "The dumping site has been cleared and a covered bin installed; the road is clean.",
    reporter_display_name: "A neighbour in Whitefield",
  },

  // --- Indiranagar dedup pair (2nd dedup demo location, ~30m apart, same type) ---
  {
    reporter_token: "seed-reporter-asha",
    id: "blr-indira-pothole-a",
    title: "Pothole on Indiranagar 12th Main",
    description: "Pothole opening up near the 12th Main / 80 Feet Rd junction",
    issue_type: "POTHOLE",
    severity: "HIGH",
    status: "OPEN",
    lat: 12.9719,
    lng: 77.6412,
    area: "Indiranagar",
    ward: "Ward 80",
    address: "12th Main Rd, Indiranagar, Bengaluru",
    still_there: 16,
    fixed_now: 1,
    createdDaysAgo: 5,
    photo: PHOTO.pothole,
    reporter_display_name: "A neighbour in Indiranagar",
  },
  {
    id: "blr-indira-pothole-b",
    title: "Another pothole near Indiranagar 12th Main",
    description: "Second pothole a few metres up the same stretch",
    issue_type: "POTHOLE",
    severity: "MEDIUM",
    status: "OPEN",
    lat: 12.97214,
    lng: 77.64142,
    area: "Indiranagar",
    ward: "Ward 80",
    address: "12th Main Rd (near junction), Indiranagar, Bengaluru",
    still_there: 5,
    fixed_now: 0,
    createdDaysAgo: 2,
    photo: PHOTO.pothole,
    reporter_display_name: "A neighbour in Indiranagar",
  },

  // --- Marathahalli: sewage overflow (modelled as WATER_LEAKAGE / BWSSB) ---
  {
    id: "blr-marathahalli-sewage",
    title: "Sewage overflow under Marathahalli Bridge",
    description: "Sewage overflowing onto the service road under the bridge",
    issue_type: "WATER_LEAKAGE",
    severity: "CRITICAL",
    status: "OPEN",
    lat: 12.9591,
    lng: 77.6974,
    area: "Marathahalli",
    ward: "Ward 85",
    address: "Outer Ring Rd, Marathahalli Bridge, Bengaluru",
    still_there: 33,
    fixed_now: 2,
    createdDaysAgo: 3,
    photo: PHOTO.water,
    reporter_display_name: "A neighbour in Marathahalli",
  },

  // --- Bellandur: damaged footpath ---
  {
    id: "blr-bellandur-footpath",
    title: "Broken footpath near Bellandur Gate",
    description: "Footpath slabs broken and uneven near the bus stop",
    issue_type: "DAMAGED_FOOTPATH",
    severity: "MEDIUM",
    status: "OPEN",
    lat: 12.926,
    lng: 77.6762,
    area: "Bellandur",
    ward: "Ward 150",
    address: "Outer Ring Rd, Bellandur Gate, Bengaluru",
    still_there: 9,
    fixed_now: 1,
    createdDaysAgo: 6,
    photo: PHOTO.footpath,
    reporter_display_name: "A neighbour in Bellandur",
  },

  // --- Yelahanka: garbage overflow ---
  {
    id: "blr-yelahanka-garbage",
    title: "Unauthorised dump growing near Yelahanka school",
    description: "Construction debris and waste piling up near a school in New Town",
    issue_type: "GARBAGE_OVERFLOW",
    severity: "HIGH",
    status: "IN_PROGRESS",
    lat: 13.1007,
    lng: 77.5963,
    area: "Yelahanka New Town",
    ward: "Ward 3",
    address: "Yelahanka New Town, Bengaluru",
    still_there: 21,
    fixed_now: 3,
    createdDaysAgo: 7,
    photo: PHOTO.garbage,
    reporter_display_name: "A neighbour in Yelahanka",
  },

  // --- Rajajinagar: broken streetlight ---
  {
    id: "blr-rajajinagar-streetlight",
    title: "Streetlight pole leaning in Rajajinagar 1st Block",
    description: "Streetlight pole leaning after a truck collision; light is out",
    issue_type: "BROKEN_STREETLIGHT",
    severity: "MEDIUM",
    status: "ACKNOWLEDGED",
    lat: 12.9907,
    lng: 77.553,
    area: "Rajajinagar 1st Block",
    ward: "Ward 99",
    address: "1st Block, Rajajinagar, Bengaluru",
    still_there: 8,
    fixed_now: 2,
    createdDaysAgo: 5,
    photo: PHOTO.streetlight,
    reporter_display_name: "A neighbour in Rajajinagar",
  },

  // --- Malleshwaram: pothole ---
  {
    id: "blr-malleshwaram-pothole",
    title: "Potholes on Malleshwaram 18th Cross",
    description: "Multiple potholes on the heritage-area road after the rains",
    issue_type: "POTHOLE",
    severity: "HIGH",
    status: "OPEN",
    lat: 13.0035,
    lng: 77.571,
    area: "Malleshwaram",
    ward: "Ward 45",
    address: "18th Cross, Malleshwaram, Bengaluru",
    still_there: 19,
    fixed_now: 3,
    createdDaysAgo: 8,
    photo: PHOTO.pothole,
    reporter_display_name: "A neighbour in Malleshwaram",
  },

  // --- BTM Layout: water leakage ---
  {
    id: "blr-btm-water",
    title: "Water main leak in BTM Layout 2nd Stage",
    description: "Treated water leaking from a main near the bus stop for days",
    issue_type: "WATER_LEAKAGE",
    severity: "HIGH",
    status: "OPEN",
    lat: 12.9166,
    lng: 77.6101,
    area: "BTM Layout 2nd Stage",
    ward: "Ward 176",
    address: "2nd Stage, BTM Layout, Bengaluru",
    still_there: 14,
    fixed_now: 2,
    createdDaysAgo: 4,
    photo: PHOTO.water,
    reporter_display_name: "A neighbour in BTM Layout",
  },

  // --- Electronic City: damaged footpath ---
  {
    id: "blr-ecity-footpath",
    title: "Damaged footpath in Electronic City Phase 1",
    description: "Footpath dug up and left unrestored on the service road",
    issue_type: "DAMAGED_FOOTPATH",
    severity: "LOW",
    status: "OPEN",
    lat: 12.8399,
    lng: 77.677,
    area: "Electronic City Phase 1",
    ward: "Ward 198",
    address: "Phase 1, Electronic City, Bengaluru",
    still_there: 6,
    fixed_now: 1,
    createdDaysAgo: 9,
    photo: PHOTO.footpath,
    reporter_display_name: "A neighbour in Electronic City",
  },
]

const AUTHORITY_BY_TYPE: Record<
  Issue["issue_type"],
  { name: string; department: string; helpline: string }
> = {
  POTHOLE: {
    name: "BBMP",
    department: "Roads & Infrastructure",
    helpline: "1533",
  },
  DAMAGED_FOOTPATH: {
    name: "BBMP",
    department: "Roads & Infrastructure",
    helpline: "1533",
  },
  GARBAGE_OVERFLOW: {
    name: "BBMP",
    department: "Solid Waste Management",
    helpline: "1533",
  },
  ENCROACHMENT: { name: "BBMP", department: "Town Planning", helpline: "1533" },
  WATER_LEAKAGE: {
    name: "BWSSB",
    department: "Water Supply",
    helpline: "1916",
  },
  BROKEN_STREETLIGHT: {
    name: "BESCOM",
    department: "Street Lighting",
    helpline: "1912",
  },
  OTHER: { name: "BBMP", department: "General Grievances", helpline: "1533" },
  NOT_A_CIVIC_ISSUE: {
    name: "BBMP",
    department: "General Grievances",
    helpline: "1533",
  },
}

function specToIssue(s: SeedSpec): Issue {
  const auth = AUTHORITY_BY_TYPE[s.issue_type]
  const createdAt = daysAgo(s.createdDaysAgo)
  const isResolved = s.status === "RESOLVED"
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    issue_type: s.issue_type,
    severity: s.severity,
    status: s.status,
    location: {
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      ward: s.ward,
      area: s.area,
    },
    photos: {
      original: s.photo,
      resolution: s.resolutionPhoto ?? null,
    },
    authority: {
      name: auth.name,
      department: auth.department,
      complaint_text: `${s.description}. Requesting prompt action from ${auth.name} ${auth.department}.`,
      escalation_days: 7,
      helpline: auth.helpline,
      priority_flag:
        s.severity === "CRITICAL"
          ? "EMERGENCY"
          : s.severity === "HIGH"
            ? "URGENT"
            : "NORMAL",
    },
    reporter_uid: "seed",
    reporter_display_name: s.reporter_display_name ?? "A neighbour",
    reporter_token: s.reporter_token,
    upvotes: s.still_there,
    upvoted_by: [],
    verification_status:
      s.still_there >= 10 ? "COMMUNITY_VERIFIED" : "UNVERIFIED",
    gemini_confidence: 0.9,
    created_at: createdAt,
    updated_at: createdAt,
    resolved_at: isResolved ? daysAgo(1) : null,
    resolution_verified: isResolved,
    resolution_reasoning: s.resolution_reasoning ?? null,
    // A resolved issue demos the Resolution Witness badge for a community member.
    resolution_witness_token: isResolved ? "seed-witness-ravi" : undefined,
    duplicate_of: null,
    confirmations: {
      still_there: s.still_there,
      fixed_now: s.fixed_now,
      last_updated: createdAt,
    },
    additional_photos: [],
  }
}

/** Fresh array of seeded issues (heatmap_weight is filled in by the store). */
export function getSeedIssues(): Issue[] {
  return SPECS.map(specToIssue)
}
