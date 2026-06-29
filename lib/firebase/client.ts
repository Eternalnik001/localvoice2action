// ============================================================
// Firebase client SDK (browser-safe).
// Lazy + guarded: if the NEXT_PUBLIC_FIREBASE_* vars are empty (the demo
// default), this no-ops and returns null instead of throwing. Nothing on the
// demo path imports it — it exists for the eventual real deployment.
// ============================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
}

/**
 * Returns the initialized Firebase client app, or null when config is absent.
 * Callers must handle null (the demo runs entirely without Firebase).
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!hasConfig()) return null
  if (getApps().length > 0) return getApp()
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  })
}
