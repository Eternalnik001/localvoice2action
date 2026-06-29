# LocalVoice2Action — 3-Minute Live Jury Demo

**Tagline:** *Every voice. Every street. Every fix.*
**One-line pitch (say first):** "A citizen snaps a photo, and an agentic AI pipeline triages it, routes it to the right Bengaluru authority, rallies the neighbourhood, and verifies the fix with before/after vision — anonymously, at zero cost."

---

## Pre-flight (do BEFORE you present)
- **Use the billing-tier Gemini key** (not free tier — the 20/day cap will break the AI moments). See DEPLOYMENT.md §1.5.
- Have a pothole photo ready to upload: `scripts/fixtures/Pothole_1_kr.jpg` (or copy it to `public/test-photos/pothole.jpg`).
- Open two tabs: the **home page** and the **resolved Jayanagar issue** (`/issues/blr-jaya-pothole-resolved`) so the slider tab is pre-warmed.
- Drive in **Chrome** (voice input + map need it).

---

## 1 · Home — the map *is* the product  *(~20s)*
- **Do:** Land on `/`.
- **Say:** "Every pin is a real citizen report — 16 issues across Bengaluru, colour-coded by status."
- **Judge sees:** Map/cards of all 16 issues, red/amber/green status colours, "16 issues reported," the amber **Report an issue** button, the **Dashboard** link.
- *Scoring: Problem/Impact, Product/Design, Google Tech (Maps).*

## 2 · Issue detail — the closed loop, proven  *(~45s)*
- **Do:** Open the **Jayanagar resolved pothole**.
- **Say:** "Here's a pothole that went from reported to *verified fixed* — and you can see every step."
- **Judge sees, top to bottom:**
  - **Severity + status pill** (Critical · Resolved)
  - **Before/After slider** — *drag it* to wipe between the pothole and the repair
  - **"✓ Verified fixed" verdict badge** (Gemini vision compared the two photos)
  - **Status timeline** — Reported → AI Triaged (routed to BBMP) → Community confirmed → Authority notified → Resolved
  - **Nearby Citizens card** — warm tagline naming *Jayanagar* + the Still There / Fixed Now vote counts
- *Scoring: Agentic Depth (vision verification), Innovation (before/after slider), Impact.*

## 3 · Report flow — the agentic pipeline live  *(~45s)*
- **Do:** Click **Report an issue** → upload the pothole photo → pick the **Koramangala** preset coordinates → submit.
- **Say:** "One photo kicks off five AI agents — vision, dedup, routing, impact, and validation."
- **Judge sees:**
  - **Loading state:** "📸 AI is analysing your report…"
  - **Friendly dedup moment:** *"This looks like the same pothole a neighbour reported ~18 m away"*
  - **"Add your photo to make it louder 📣"** CTA — non-blocking, invites corroboration
- *Scoring: Agentic Depth (real Gemini function-calling for dedup/routing), Innovation, Google Tech (Gemini).*

> **If Gemini is slow (>6s):** "The AI pipeline is classifying the photo, routing to the right authority, and estimating community impact — usually under 3 seconds."
> **If it returns a fallback/error:** "The system degrades gracefully — the report is still filed, and the community features still work."

## 4 · Voice input — "LocalVoice"  *(~15s)*
- **Do:** On the report form, click the **🎙 Speak** button and say *"broken streetlight on 100ft road."*
- **Say:** "Citizens who can't type still get heard — voice in their own English."
- **Judge sees:** Mic turns red ("Listening…") → the transcript appears in the description field (en-IN).
- *Scoring: Innovation, Accessibility, Product/Design.*

## 5 · Dashboard — public accountability  *(~30s)*
- **Do:** Go to `/dashboard`.
- **Say:** "Everything's public — this is the accountability layer for the whole city."
- **Judge sees:**
  - **City stats bar** — total reported, resolved this month, avg resolution time, most active area
  - **"What Bengaluru is reporting"** — colour-coded bar chart by issue type
  - **"Which areas are getting fixed"** — open vs resolved grouped chart
  - **Neighbourhood leaderboard** — top areas + resolution-rate bars + top badge
- *Scoring: Impact, Innovation, Google Tech (predictive insight), Completeness.*

## 6 · Badges & identity — frictionless gamification  *(~20s)*
- **Do:** Back on the report you just filed, in the **"Pick a nickname"** prompt, type a name → **Save**. Open the issue.
- **Say:** "No login, no email — an anonymous nickname unlocks the badges that report earned."
- **Judge sees:** NicknamePrompt → "Saved! Welcome 👋" → **badge pills** (🥇 First Reporter / 🏅 Vigilant Neighbour) on the issue.
- *Scoring: Innovation, Product/Design, Completeness.*

---

## Close  *(~10s)*
"Photo to verified fix, fully anonymous, with the AI doing the diagnosis, the paperwork, and the proof — built on Google AI Studio, Gemini, Maps, and Cloud Run."

## If a judge asks about cost
"**Zero rupees** — Cloud Run scale-to-zero, Gemini free tier with in-memory caching, and a Maps key billing-capped at ₹0 overage."

## If a judge asks "is this really anonymous?"
"Tier 1 is fully anonymous forever — votes use a hashed IP, never stored raw. A nickname is optional Tier 2, in-memory only, never sent anywhere external."
