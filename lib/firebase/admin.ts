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
  type App,
} from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

function hasAdminConfig(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  )
}

function getAdminApp(): App | null {
  if (!hasAdminConfig()) return null
  if (getApps().length > 0) return getApp()
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // The key is stored as a single line with literal \n escapes; restore them.
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

/**
 * Returns the Admin Firestore instance, or null when admin config is absent.
 * The data layer (lib/data) uses this to decide whether to select the
 * Firestore driver or the in-memory driver.
 */
export function getAdminDb(): Firestore | null {
  const app = getAdminApp()
  if (!app) return null
  return getFirestore(app)
}
