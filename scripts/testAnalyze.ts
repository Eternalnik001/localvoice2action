// ============================================================
// One-off manual test for POST /api/analyze-issue.
//
// Prereqs:
//   1. Dev server running:  npm run dev   (http://localhost:3000)
//   2. A real civic-issue photo at scripts/fixtures/pothole.jpg
//      (override with: IMAGE=/path/to/photo.jpg)
//   3. GEMINI_API_KEY set in .env.local (this makes a REAL Gemini call)
//
// Run (no ts-node needed — Node 22+ strips types):
//   node scripts/testAnalyze.ts
//
// Sends the Koramangala 4th Block coordinates so it exercises the dedup path
// against the seeded potholes there.
// ============================================================

import { readFile, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const FIXTURES_DIR = path.join(process.cwd(), "scripts/fixtures")

// Koramangala 4th Block (near the seeded potholes → exercises dedup).
const LAT = "12.9352"
const LNG = "77.6245"
const AREA = "Koramangala 4th Block"

// Any common image format is accepted — the photo doesn't have to be a .jpg.
const IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".heic",
  ".heif",
])

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
}

function mimeFromPath(p: string): string {
  return MIME_BY_EXT[path.extname(p).toLowerCase()] ?? "image/jpeg"
}

/** Explicit IMAGE= override, else the first image (any format) in scripts/fixtures/. */
async function resolveImagePath(): Promise<string | null> {
  if (process.env.IMAGE) {
    return existsSync(process.env.IMAGE) ? process.env.IMAGE : null
  }
  if (!existsSync(FIXTURES_DIR)) return null
  const entries = await readdir(FIXTURES_DIR)
  const image = entries
    .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort()[0]
  return image ? path.join(FIXTURES_DIR, image) : null
}

async function main(): Promise<void> {
  const imagePath = await resolveImagePath()
  if (!imagePath) {
    console.error(
      `\n❌ No image found.\n` +
        `   Drop a civic-issue photo (any format: jpg/png/webp/gif/heic/…) into:\n` +
        `     ${FIXTURES_DIR}/\n` +
        `   or run with an explicit path:  IMAGE=/path/to/photo.png node scripts/testAnalyze.ts\n`
    )
    process.exit(1)
  }

  const bytes = await readFile(imagePath)
  const mimeType = mimeFromPath(imagePath)

  const form = new FormData()
  form.append("photo", new Blob([new Uint8Array(bytes)], { type: mimeType }), path.basename(imagePath))
  form.append("lat", LAT)
  form.append("lng", LNG)
  form.append("area", AREA)

  const url = `${BASE_URL}/api/analyze-issue`
  console.log(`\n→ POST ${url}`)
  console.log(`  image: ${imagePath} (${mimeType}, ${bytes.length} bytes)`)
  console.log(`  coords: ${LAT}, ${LNG} (${AREA})\n`)

  let res: Response
  try {
    res = await fetch(url, { method: "POST", body: form })
  } catch (err) {
    console.error(
      `❌ Could not reach ${url}. Is the dev server running? (npm run dev)\n`,
      err instanceof Error ? err.message : err
    )
    process.exit(1)
  }

  const text = await res.text()
  console.log(`← HTTP ${res.status} ${res.statusText}\n`)
  try {
    console.log("Raw JSON response:")
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log("Raw (non-JSON) response:")
    console.log(text)
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err)
  process.exit(1)
})
