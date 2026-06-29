// ============================================================
// Firebase Admin SDK (SERVER-ONLY).
// Lazy + guarded: if FIREBASE_ADMIN_* vars are empty (the demo default),
// getAdminDb() returns null and the app falls back to the in-memory data
// store. Replaces the \n escapes in the private key at runtime.
// ============================================================

import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

// Explicit service-account creds (used for LOCAL dev with a downloaded key).
function hasExplicitConfig(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  )
}

// Select the Firestore driver when EITHER explicit creds are present, OR we're
// told to use ADC (USE_FIRESTORE=1). On Cloud Run, Application Default
// Credentials come from the service-account identity — no key/secret needed.
function firestoreEnabled(): boolean {
  return hasExplicitConfig() || process.env.USE_FIRESTORE === "1"
}

function getAdminApp(): App | null {
  if (!firestoreEnabled()) return null
  if (getApps().length > 0) return getApp()

  if (hasExplicitConfig()) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // The key is stored as a single line with literal \n escapes; restore them.
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    })
  }

  // ADC path (Cloud Run / Cloud Shell / any gcloud-authed env). No secret.
  return initializeApp({
    credential: applicationDefault(),
    projectId:
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT,
  })
}

// Memoized so settings() — which may be called only ONCE, before any other use
// of the Firestore instance — runs exactly once on first acquisition.
let firestoreInstance: Firestore | null = null

/**
 * Returns the Admin Firestore instance, or null when admin config is absent.
 * The data layer (lib/data) uses this to decide whether to select the
 * Firestore driver or the in-memory driver.
 */
export function getAdminDb(): Firestore | null {
  if (firestoreInstance) return firestoreInstance

  const app = getAdminApp()
  if (!app) return null

  const db = getFirestore(app)
  // Issue objects carry optional fields (reporter_token, resolution_witness_token,
  // resolution_reasoning, …) that are frequently `undefined`. Firestore rejects
  // `undefined` by default, which made seeding AND new-issue writes throw 500.
  // Dropping undefined fields (instead of throwing) is the documented remedy.
  db.settings({ ignoreUndefinedProperties: true })

  firestoreInstance = db
  return firestoreInstance
}
