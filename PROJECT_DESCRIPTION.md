# LocalVoice2Action
### Every voice. Every street. Every fix.

**A hyperlocal civic-issue reporting and resolution platform for Bengaluru, powered by an agentic AI pipeline.**

**Live application:** https://localvoice2action-mkeeof7vsq-el.a.run.app
**Source code:** https://github.com/Eternalnik001/localvoice2action

---

## Problem Statement Selected

**Empowering citizens to report, track, and resolve hyperlocal civic issues — and holding the system accountable for the outcome.**

In a city like Bengaluru, civic reporting is broken at every step of the loop:

- **Fragmented.** Complaints are scattered across multiple authorities — BBMP for roads and garbage, BWSSB for water, BESCOM for electricity, BDA for development. A citizen must first know *which* department owns *which* problem before they can even report it.
- **Opaque.** Once a complaint is filed, it vanishes into a black box. There is no status, no public map of what is broken on a given street, and no accountability for whether anything happens.
- **Duplicate-heavy.** The same pothole is reported by twenty different neighbours. Authorities see noise instead of signal, and citizens feel ignored.
- **Unvalidated.** A complaint marked "resolved" is taken on faith. Nobody checks whether the pothole was actually filled or the leak actually stopped.

The compounding result is civic apathy: **people stop reporting, because reporting feels pointless.** The core problem is not a lack of complaints — it is a broken loop that never reliably closes from *report* to *verified fix*.

---

## Solution Overview

**LocalVoice2Action closes the civic loop end to end.** A citizen takes a single photo of a problem, and an autonomous AI pipeline carries it all the way to a verified resolution that the whole neighbourhood can see:

> **Citizen photo → AI triage → de-duplication within 500m → automatic routing to the correct authority → community verification → resolution confirmed by before/after vision → public accountability dashboard.**

Each stage is handled by a dedicated, server-side AI agent. The defining principle is that **a report does not end at submission — it ends at a vision-verified fix on a public map.** Where existing systems treat a complaint as a fire-and-forget ticket, LocalVoice2Action treats it as a tracked, community-owned outcome.

The platform is intentionally **frictionless and anonymous**: no login is required to report or verify an issue, which removes the single biggest barrier to civic participation. At the same time, it builds a sense of collective ownership — surfacing how many neighbours are affected by a problem and recognising the people who report and confirm fixes.

---

## Key Features

- **AI photo triage.** A multimodal vision model reads a single photo and infers the issue type, severity, a clear description, and whether it needs immediate attention — no manual categorisation by the citizen.

- **Smart de-duplication.** A geospatial pre-filter combined with AI function-calling detects when a new report matches an existing one nearby. Instead of a cold "rejected — duplicate," the app warmly invites the citizen to *add a confirming photo*, turning duplicates into stronger signal.

- **Automatic routing and complaint drafting.** The platform maps each issue to the correct civic authority and generates a ready-to-send, formally worded complaint with the right helpline and priority — removing the "which department do I even contact?" barrier.

- **Before / After resolution slider.** On resolved issues, a draggable wipe-comparison lets anyone slide between the original and the fix. The resolution is *seen*, not merely claimed — and is cross-checked by a vision model.

- **"You're not alone" impact card.** For every issue, the platform estimates how many residents, commuters, businesses, and delivery workers are affected nearby, reframing a solitary complaint as a shared community cause.

- **Anonymous community verification.** Frictionless *Still There / Fixed Now* voting keeps issue status honest and current, with privacy-preserving de-duplication so each person counts once — without ever storing a raw identity.

- **Civic gamification.** Neighbourhood badges and a public leaderboard recognise active citizens and foster a sense of belonging and friendly local pride.

- **Voice input.** Citizens can describe an issue by speaking, using India-English speech recognition — lowering the barrier for users who find typing difficult.

- **Public accountability dashboard.** Live charts show resolution rates by area and by category, plus AI-generated predictive insights about the city's civic health — making authority performance transparent to everyone.

- **Interactive live map.** A full Google Map renders every issue as a state-aware pin — severity-coloured when active (CRITICAL pins pulse), grey ✅ when the community reports it fixed, green ✅ when authority-resolved (fading after a week) — with a one-tap Pins ↔ Heatmap toggle.

- **Resilient by design.** Every AI call is bounded by a timeout with a graceful fallback, each major section is isolated by an error boundary, and routes show loading skeletons — so one slow or failing dependency never takes the experience down.

---

## Technologies Used

- **Next.js 14 (App Router)** — a single framework serving both the user interface and the secure server-side API layer that orchestrates the AI agents.
- **TypeScript (strict mode)** — end-to-end type safety with a zero-`any` discipline across the codebase.
- **Agentic architecture** — the AI pipeline is composed of small, single-purpose, pure-function agents, cleanly separated from persistence; route handlers orchestrate them. This makes each agent independently understandable, testable, and reliable.
- **Pluggable data layer** — a single factory resolves to an in-memory store (for instant, dependency-free running) or a cloud database (for durable persistence) behind one interface, with no changes to application code.
- **Tailwind CSS** — a consistent, modern design system with a defined brand palette and typography.
- **Recharts** — the data visualisations on the accountability dashboard, lazy-loaded to keep the app fast.
- **framer-motion & lucide-react** — smooth micro-interactions and crisp, lightweight iconography.
- **Web Speech API** — browser-native voice input for the reporting flow.
- **Docker (multi-stage build)** — a small, self-contained production image for reproducible, scalable deployment.

---

## Google Technologies Utilized

Google's platform powers the intelligence, the geography, the data, and the hosting of the application — it is the backbone of the solution end to end.

- **Google Gemini (`gemini-3.5-flash`)** via the official **`@google/genai`** SDK — the engine behind the entire agent pipeline. It is used in three distinct, advanced modes:
  - **Multimodal vision** — analysing citizen photos to classify issues, and comparing before/after images to verify resolutions.
  - **Function-calling** — structured, tool-based reasoning that drives the intelligent de-duplication decision.
  - **Generative reasoning** — drafting formal authority complaints, estimating human impact, and producing the dashboard's predictive city insights.

- **Google AI Studio** — used to design, test, and refine every agent prompt against `gemini-3.5-flash`, to select the model, and to provision the API key that the deployed application uses.

- **Google Maps Platform** — the Maps JavaScript API (interactive map with AdvancedMarkerElement pins + a weighted heatmap view) and the Geocoding API to resolve citizen GPS to real Bengaluru neighbourhoods.

- **Cloud Firestore** — durable, real-time persistence for issues, community confirmations, and resolution records, so reports and fixes persist and are shared across the platform.

- **Google Cloud Run** — the application is containerised and deployed on Cloud Run, scaling to zero when idle and scaling out under load, with a stable public URL.

- **Cloud Build** — builds the container image directly from source as part of the deployment pipeline.

- **Application Default Credentials & IAM** — the deployed service authenticates to Firestore through its own managed Cloud identity, so no credential secrets are stored or shipped.

---

**In one line:** LocalVoice2Action uses Google's AI and cloud stack to transform a single citizen photo into an accountable, community-verified civic fix — closing a loop that has stayed open for far too long.
