// ============================================================
// LocalVoice2Action — shared TypeScript types
// Single source of truth for issue / user / agent shapes.
// ============================================================

export type IssueType =
  | "POTHOLE"
  | "WATER_LEAKAGE"
  | "BROKEN_STREETLIGHT"
  | "GARBAGE_OVERFLOW"
  | "DAMAGED_FOOTPATH"
  | "ENCROACHMENT"
  | "OTHER"
  | "NOT_A_CIVIC_ISSUE"

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type IssueStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"

export type VerificationStatus =
  | "UNVERIFIED"
  | "COMMUNITY_VERIFIED"
  | "DISPUTED"

export type Badge =
  | "NEWCOMER"
  | "REPORTER"
  | "VERIFIED_HERO"
  | "COMMUNITY_CHAMPION"

export type PriorityFlag = "NORMAL" | "URGENT" | "EMERGENCY"

export interface GeoLocation {
  lat: number
  lng: number
  address: string
  ward: string
  area: string
}

export interface IssueAuthority {
  name: string
  department: string
  complaint_text: string
  escalation_days: number
  helpline: string
  priority_flag: PriorityFlag
}

export interface IssuePhotos {
  original: string
  resolution: string | null
}

/** Anonymous community vote tallies on an issue. */
export interface IssueConfirmations {
  still_there: number
  fixed_now: number
  last_updated: Date | null
}

export interface Issue {
  id: string
  title: string
  description: string
  issue_type: IssueType
  severity: Severity
  status: IssueStatus
  location: GeoLocation
  photos: IssuePhotos
  authority: IssueAuthority
  reporter_uid: string
  upvotes: number
  upvoted_by: string[]
  verification_status: VerificationStatus
  gemini_confidence: number
  created_at: Date
  updated_at: Date
  resolved_at: Date | null
  resolution_verified: boolean
  resolution_reasoning: string | null
  duplicate_of: string | null
  // ----- Phase 2 additive fields (optional → backward-compatible) -----
  /** Anonymous "Still There" / "Fixed Now" tallies. */
  confirmations?: IssueConfirmations
  /** Pre-calculated, community-amplified heatmap weight; rewritten on each vote. */
  heatmap_weight?: number
  /** Warm, human attribution ("A neighbour in HSR"); may be anonymous. */
  reporter_display_name?: string
  /** Confirming photos added by neighbours via the dedup "add a photo" path. */
  additional_photos?: string[]
  /** Cached Agent 6 impact estimate (avoids re-billing Gemini on every view). */
  impact_estimate?: NearbyCitizens
  /** Anonymous reporter identity (salted IP-hash) — powers derived badges. Never a raw IP. */
  reporter_token?: string
  /** Set when a community after-photo verified this fix (Resolution Witness trigger). */
  resolution_witness_token?: string
  /** Tokens whose corroborating photo was AI-confirmed on this issue (Truth Checker trigger). */
  truth_checker_tokens?: string[]
}

export interface CivicUser {
  uid: string
  display_name: string
  email: string
  photo_url: string
  reports_count: number
  verifications_count: number
  badge: Badge
  created_at: Date
}

// ----- Community / recognition types ------------------------

/** Richer community badge taxonomy (engine deferred; types defined for UI/copy). */
export type CommunityBadge =
  | "NEIGHBOURHOOD_NEWCOMER"
  | "STREET_SENTINEL"
  | "WARD_WATCHDOG"
  | "COMMUNITY_CHAMPION"
  | "DISTRICT_GUARDIAN"

export type ConfirmationVote = "STILL_THERE" | "FIXED_NOW"

/** A single anonymous confirmation (stored with a hashed IP — never raw). */
export interface Confirmation {
  issue_id: string
  vote: ConfirmationVote
  ip_hash: string
  created_at: Date
}

// ----- Nearby Citizens / "People affected" (Agent 6) --------

/** Gemini-estimated breakdown of who an issue affects. */
export interface NearbyCitizens {
  nearby_residents: number
  commuters: number
  businesses: number
  delivery_partners: number
  /** One warm, human sentence shown subtly under the card. */
  reasoning: string
  /** 0..1 — drives the low-confidence ("rough estimate") UI variant. */
  confidence: number
}

// ----- Dedup (Agent 2, UX-facing) ---------------------------

/** A nearby existing issue that the new report might duplicate. */
export interface DuplicateCandidate {
  issue_id: string
  distance_meters: number
  issue_type: IssueType
  title: string
  severity: Severity
  area: string
  existing_photo_url: string
  /** Neighbours who've confirmed it's still there (collective-strength copy). */
  still_there_count: number
  existing_description: string
  created_at: Date
  reporter_display_name?: string
}

/**
 * Result of the friendly, non-blocking dedup check. Coexists with Agent2Output
 * (the canonical MERGE/CREATE verdict); this is the shape the report UI uses to
 * let the user CHOOSE to add a confirming photo instead of being blocked.
 */
export interface DeduplicateResult {
  is_likely_duplicate: boolean
  best_candidate: DuplicateCandidate | null
  candidates: DuplicateCandidate[]
  reasoning: string
}

// ----- Agent I/O contracts ----------------------------------
// Each agent is a pure function; these are its validated outputs.

export interface Agent1Output {
  issue_type: IssueType
  severity: Severity
  confidence: number
  description: string
  requires_immediate_action: boolean
  visual_evidence: string
}

export interface Agent2Output {
  action: "MERGE" | "CREATE"
  duplicate_of: string | null
  matched_issue_id: string | null
  distance_meters: number | null
  reasoning: string
}

export interface Agent3Output {
  authority: string
  department: string
  complaint_text: string
  escalation_threshold_days: number
  helpline: string
  priority_flag: PriorityFlag
}

export interface Agent4Output {
  validation: "CONFIRMED" | "DISPUTED" | "ESCALATED"
  verification_status: VerificationStatus
  confidence: number
  photos_match: boolean
  reasoning: string
}

export interface Agent5Output {
  resolution_status:
    | "RESOLVED"
    | "PARTIALLY_RESOLVED"
    | "NOT_RESOLVED"
    | "CANNOT_DETERMINE"
  confidence: number
  reasoning: string
  visible_improvements: string[]
  remaining_issues: string[]
}
