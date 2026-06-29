# BUILD_LOG — LocalVoice2Action

> Hyperlocal civic issue reporting & resolution for Bengaluru.
> **"Every voice. Every street. Every fix."**
>
> Google Cloud AI Hackathon submission. Deadline **2026-06-28 20:00 IST**. Must use Google AI Studio + Gemini; deploy to Cloud Run.

This is the chronological build log / changelog for the submission, recording the work from foundation through the latest updates. Entries are dated; the working date for all entries below is **2026-06-22**.

---

## 2026-06-22 — Phase 1: Foundation (types, prompts, JSON utils)
x
**What changed**
- Established the shared type system for the whole app: issue records, severity scale, agent input/output contracts, authority enum (BBMP / BWSSB / BESCOM / BDA), confirmation/vote records.
- Authored the agent prompt library — one structured prompt per agent, each instructing strict JSON output so responses are machine-parseable.
- Built the JSON utilities, centered on `parseGeminiResponse()` — the single, defensive parser every Gemini call routes its output through (handles fenced code blocks, stray prose, and malformed payloads without throwing into the request path).

**Why**
- Locking the types and the agent contracts first means every later phase (agents, routes, UI) compiles against one source of truth — no drift between what an agent returns and what a route handler expects.
- A single JSON parser enforces the code rule that **no `JSON.parse()` is ever called directly** — all model output is funneled through `parseGeminiResponse()`.

**Files touched**
- `lib/types/*` — core domain + agent I/O types.
- `lib/prompts/*` — per-agent prompt templates.
- `lib/utils` — `parseGeminiResponse()` and JSON helpers.

---

## 2026-06-22 — Decision: Stack correction (drop Gemini 1.5 / old SDK)

**What changed**
- **Dropped** the original spec's `@google/generative-ai` SDK (EOL) and **Gemini 1.5** model targets.
- **Adopted** the `@google/genai` SDK and standardized on **`gemini-3.5-flash` for ALL agents**.
- Reclassified the Gemini key as **server-only**: `GEMINI_API_KEY` (never `NEXT_PUBLIC_`). The Maps key stays public as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

**Why**
- `@google/generative-ai` is end-of-life; `@google/genai` is the current, supported SDK.
- **Gemini 1.5 is shut down and 404s** — any agent pinned to it would fail at runtime, which is fatal for a live demo and for the "Google Tech" / "Completeness" scoring.
- A Gemini key embedded in client code (`NEXT_PUBLIC_*`) would leak the secret to every browser. Keeping it server-only means all model calls happen in route handlers / server code, satisfying the "no hardcoded / no client-exposed secrets" rule.

**Rationale**
- The corrections and reasoning above are the authoritative record for the stack choices.

---

## 2026-06-22 — Phase 2A: Foundation scaffolding

Everything below was created in Phase 2A. This is the full inventory of files.

**What changed / Files touched**

- **`tsconfig.json`** — TypeScript **strict** mode on (zero `any` policy enforced at compile time).
- **`next.config.*`** — Next.js 14 App Router configuration.
- **Tailwind theme** (`tailwind.config.*`) — brand palette: brand blue `#1D4ED8`, amber `#F59E0B`, **Inter** typeface, plus the severity color scale.
- **`app/globals.css` + root layout** — global styles and the **Inter** font wired into the App Router layout.
- **`lib/gemini/client.ts`** — the Gemini client wrapper exposing `generateJson(...)` and `assertGeminiEnv()`. Every model call goes through this; output is parsed via `parseGeminiResponse()` and wrapped in try/catch.
- **`lib/firebase/client.ts`** and **`lib/firebase/admin.ts`** — Firebase client + Admin SDK initializers, written to be **inert when env is empty** (no credentials -> they no-op rather than throw), so the app boots with just a Gemini key.
- **`lib/maps/*`** — geo utilities: **Haversine** distance (powers the 500m dedup radius) and the **heatmap weight** computation.
- **`lib/security/iphash.ts`** — IP hashing for anonymous confirmation dedup (**raw IP is never stored**).
- **Data Access Layer (DAL)** — the full persistence abstraction:
  - DAL types,
  - **in-memory store seeded with Bengaluru data** (so the demo runs with no Firebase),
  - Firestore-backed store,
  - a `getStore()` factory that selects memory vs. Firestore based on env.
- **`framer-motion`** added as a dependency (for the upcoming animated UI moments).

**Why**
- This is the runtime spine. With the DAL's in-memory Bengaluru seed, **the entire demo runs with just a Gemini API key** — no Firebase project required — which de-risks the deploy and the live judging run.
- Inert-when-empty Firebase clients mean the same codebase upgrades to real persistence by supplying credentials, without branching logic in route handlers.
- Keeping geo math (Haversine) and heatmap weight as pure utilities keeps the agent files pure (no I/O), per the code rules.

---

## 2026-06-22 — Community features designed + warmer-tone direction

Three community-friendly features were designed in Phase 2A (to be built in Phases 2C–2D), alongside an overall tone shift.

**What was designed**

1. **Before & After draggable slider** — a wipe-comparison slider on the issue detail page's resolution section, so the "fixed" moment is visible and satisfying.
2. **Nearby Citizens / "People affected" card (Agent 6)** — a new Impact Estimator micro-agent estimates how many nearby residents, commuters, businesses, and delivery partners an issue affects, framed as a warm **"you're not alone"** card. Adds extra agentic depth.
3. **Friendly AI duplicate-detection moment** — in the report flow, when Agent 2 finds a nearby match it says something like *"same pothole reported ~18m away"* and **invites adding a confirming photo**. It is **non-blocking** and **never says "duplicate" or "rejected."**

**Warmer-tone direction (overall)**
- Warm, human copy throughout; collective-impact framing.
- Frictionless anonymous participation — **"Still There" / "Fixed Now"** actions with IP-hash dedup.
- Recognition & belonging — badges and neighbourhood identity.

**Why**
- Innovation (20%) and Product/Design (10%) reward features that feel human and encourage participation. The friendly dedup moment in particular turns a normally discouraging "rejected duplicate" interaction into an invitation to contribute — increasing signal per issue instead of suppressing reports.

**Files touched**
- Design only at this stage (types/prompts for Agent 6 captured in Phase 1 contracts). Implementation lands in Phases 2C–2D.

---

## 2026-06-22/23 — Phase 2B: Agent pipeline + orchestration routes

**What changed**
- Built all six agents as **pure functions** in `lib/agents/` (no DB/Firestore inside; persistence lives in routes):
  - `visionAnalyst.ts` — classify photo → type / severity / title / description; returns null on low confidence; **in-memory cache keyed by photo hash** (demo-day quota protection).
  - `dedupAgent.ts` — **genuine Gemini function-calling** (`find_duplicates` tool, `FunctionCallingConfigMode.ANY`, reads `response.functionCalls`); fails open to "create".
  - `routingAgent.ts` — deterministic authority/ward from `wardMapping`, Gemini-drafted complaint with fallback; never fails.
  - `communityValidator.ts` — two-image validation; DISPUTED on failure.
  - `resolutionVerifier.ts` — before/after vision verdict; `cant_tell` on low confidence.
  - `impactEstimator.ts` (Agent 6) — affected-cohort estimate + warm tagline; per-field bounds injected into the prompt **and** clamped; cached by type|area|severity.
- Routes: `analyze-issue` (orchestrates vision → dedup → routing → impact, outside-Bengaluru guard, returns badges), `confirm-issue`, `add-confirmation`, `estimate-impact`, `verify-resolution`.
- Supporting data: `wardMapping.ts` (authority/ward lookup), `areaGrouping.ts`.

**Why**
- Pure agents + route-level persistence keeps the agent layer testable and side-effect-free (code rule). Real function-calling in dedup is what earns **Agentic Depth (20%)** — it's a true tool-call, not a chained prompt.

---

## 2026-06-23 — Phase 2C: Issue detail page (Features 1 & 2)

**What changed**
- `app/issues/[id]/page.tsx` (server) — carded intro (severity + status pills, reporter line + earned badges), "← Back to map".
- `components/BeforeAfterSlider.tsx` (**Feature 1**) — pure React/Tailwind wipe slider (mouse + touch + keyboard via an overlay range input), verdict chip, BEFORE/AFTER pills, success tint.
- `components/NearbyCitizensCard.tsx` (**Feature 2**) — warm "you're not alone" tagline, 4 affected-cohort tiles, frictionless **Still There / Fixed Now** voting (optimistic UI), progress bar.
- `components/issues/IssueTimeline.tsx` — vertical status timeline **derived** from issue fields (can't drift).
- `SeverityBadge`, `BadgePills` supporting components.

**Why** — Innovation + Product/Design: the resolved "before/after" moment and collective-impact framing are the emotional payoff of the product.

---

## 2026-06-23 — Phase 2D: Report flow + voice (Feature 3)

**What changed**
- `app/report/page.tsx` (client) — photo upload → `/api/analyze-issue` → branches: **merge** (warm "a neighbour spotted this too" card + optional add-photo, **never** says "duplicate/rejected"), **create** (new-issue summary + impact tagline + earned badge + nickname prompt), **outside-Bengaluru** (friendly), **retry** (warm, never "error").
- `components/VoiceInputButton.tsx` — the "LocalVoice" feature: browser **Web Speech API** (en-IN), hides itself when unsupported; transcript **appends** to the note.

**Why** — turns the discouraging "duplicate rejected" interaction into an invitation; voice lowers the barrier to reporting.

---

## 2026-06-23 — Phase 2E + 3: Resolution, home map, dashboard, gamification

**What changed**
- `app/api/verify-resolution/route.ts` — writes resolution photo + status via the resolution verifier → gives the slider a live verdict.
- Home `app/page.tsx` + `components/map/IssueMapOrList.tsx` — **three-tier, zero-cost map**: static map image (cheap SKU) → interactive JS SDK only on click → list fallback (no key). Status-colored markers. Gradient hero + stat chips. `RecentIssuesStrip`.
- Dashboard `app/dashboard/page.tsx` — 4 stat cards, 2 recharts charts (lazy via `DashboardChartsLazy`, `ssr:false`), recent activity feed, **neighbourhood leaderboard**. Stats in `lib/data/dashboardStats.ts`.
- **Gamification** — anonymous IP-hash badges (`MyBadges`, `BadgePills`), leaderboard, optional **Tier-2 nickname** identity (`citizens.ts`, `NicknamePrompt`, `register-citizen` + `my-badges` routes). Session-durable, not persisted.
- DAL completed: `memory-store.ts` (default, **16-issue Bengaluru seed** incl. 2 resolved w/ before/after photos), `firestore-store.ts` (built, unselected), `getStore()` factory.

**Why** — Completeness + Product/Design: the map is the product; the dashboard is the accountability story; gamification drives repeat participation. Zero-cost map design honours the hard cost constraint.

---

## 2026-06-23 — Phase 4: Deploy readiness + final polish

**What changed**
- **Cloud Run ready** — multi-stage `Dockerfile` (node:20-alpine, Next.js `output: standalone`), `.dockerignore`, `next.config.js`.
- Submission docs authored — `README.md`, `docs/{ARCHITECTURE, AI_STUDIO_AND_GEMINI, DEPLOYMENT}.md`, `DEMO_SCRIPT.md`, this BUILD_LOG.
- **Gemini-powered predictive InsightCards** (`lib/agents/insightAgent.ts` + `app/api/insights/route.ts` + `components/dashboard/InsightCards.tsx`) — 3 hyperlocal insight cards on the dashboard; **in-memory 1-hour cache** (generated at most once/hour, not per visit); 2 hardcoded fallback cards so the section is never empty.
- **Mobile responsive pass** (audited at 390px / 414px) — home map auto-switches to **list on mobile** (`matchMedia`); `RecentIssuesStrip` stacks vertically on mobile; slider grabber → 44px touch target; `VoiceInputButton` → 44px; home CTA row wraps. Dashboard grid, NearbyCitizens grid, leaderboard, timeline confirmed already responsive.
- Map APIs verified enabled (Static / JS / Geocoding all 200). `tsc` clean, `npm run build` clean (14 routes).

**Why** — a hackathon is judged live on a phone; the responsive pass + the static-map-first design make the demo reliable at zero cost. InsightCards add a second visible Gemini surface (Google Tech / Innovation).

---

## Open items / Risks (current — 2026-06-23)

- **🔴 #1 RISK — Gemini free-tier cap.** The `AQ.` key authenticates fine (`AQ.` is the *current* AI Studio key format, not an anomaly), but the **free tier caps ~20 requests/day** → live AI will 429 during a busy demo. Agents fail *open* (fallbacks render, nothing crashes), but **swap in a billing-tier key before judging.** Documented in `docs/DEPLOYMENT.md §1.5`.
- **🟠 Restrict the Maps key** before public deploy — HTTP-referrer (Cloud Run domain + localhost) + API restriction (Static/JS/Geocoding) + quota cap. Currently unrestricted.
- **🟡 Deploy to Cloud Run** — Dockerfile + docs ready; not yet deployed.
- **AI Studio compliance** — app is hand-built, not generated in AI Studio Build mode; the defensible approach (AI Studio central to the AI layer + deploy, with evidence) and its honest risk are in `docs/AI_STUDIO_AND_GEMINI.md`.
- **Behind-proxy IP** — confirm IP-hash dedup reads the correct client IP behind Cloud Run's proxy (never persists raw IP).

---

## Build inventory (verified 2026-06-23)

**Agents (6):** visionAnalyst · dedupAgent (function-calling) · routingAgent · communityValidator · resolutionVerifier · impactEstimator · *plus* insightAgent (dashboard).
**Routes (8):** analyze-issue · confirm-issue · add-confirmation · estimate-impact · verify-resolution · register-citizen · my-badges · insights.
**Pages (4):** `/` · `/dashboard` · `/issues/[id]` · `/report`.
**Status:** `npx tsc --noEmit` clean · `npm run build` clean (14 routes).
