// ============================================================
// Data-store factory — the single switch point.
// Returns the Firestore driver IFF Firebase Admin is configured, else the
// in-memory driver (the demo default). Components and route handlers only
// ever call getStore(); they never know which driver they got.
// ============================================================

import "server-only"
import type { DataStore } from "@/lib/data/types"
import { getMemoryStore } from "@/lib/data/memory-store"
import { getAdminDb } from "@/lib/firebase/admin"
import { createFirestoreStore } from "@/lib/data/firestore-store"

/** One vote per hashed IP per issue per 24h. */
export const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000

let cached: DataStore | null = null
let loggedDriver = false

export function getStore(): DataStore {
  if (cached) return cached

  const adminDb = getAdminDb()
  if (adminDb) {
    cached = createFirestoreStore(adminDb)
    if (!loggedDriver) {
      console.log("[data] driver: firestore")
      loggedDriver = true
    }
  } else {
    cached = getMemoryStore()
    if (!loggedDriver) {
      console.log("[data] driver: memory (no Firebase Admin config — demo mode)")
      loggedDriver = true
    }
  }
  return cached
}

export type { DataStore, CreateIssueInput } from "@/lib/data/types"

import { deriveBadgesForToken } from "@/lib/badges"
import type { Badge } from "@/lib/badges"

/**
 * Badges earned by an anonymous reporter token, derived by scanning all issues.
 * (Data-layer convenience; badges are computed, never separately stored.)
 */
export async function getBadgesForToken(ipHash: string): Promise<Badge[]> {
  const issues = await getStore().listIssues()
  return deriveBadgesForToken(ipHash, issues)
}
