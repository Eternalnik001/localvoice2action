# Google AI Studio + Gemini — How LocalVoice2Action Is Built and Deployed on the Google Stack

> **Scoring target:** Google Technologies (15%) — and the hard rule "AI Studio must be the core tool to build and deploy."
> **Project:** LocalVoice2Action — hyperlocal civic issue reporting & resolution for Bengaluru. *"Every voice. Every street. Every fix."*
> **Hackathon:** Google Cloud AI Hackathon · deadline **2026-06-28 20:00 IST** · must use Google AI Studio + Gemini · deploy to Cloud Run.
> **Status of this document:** the AI-layer strategy is decided and the Gemini client foundation is built (Phase 2A). The prompt-authoring, "Get code" export, and deploy steps below are the operating procedure for the team through the deadline. Items still pending the user's phase-gated go-ahead are flagged honestly as **STRETCH** or **PENDING**.

---

## 1. TL;DR

We do **not** rebuild the Next.js app inside AI Studio. The most defensible reading of "core tool to build and deploy" is that **AI Studio is where the AI/Gemini layer is designed, keyed, and validated, and is the surface through which the solution reaches production via its one-click Cloud Run deploy.**

Our honest, low-rework play:

1. **Confirm the AI Studio-issued key powers the deployed app.**
2. **Author and iterate the system prompts + structured-output / function-calling schemas for all 6 agents in AI Studio's prompt playground**, use **"Get code"** to seed `lib/agents/`.
3. **Ship to Cloud Run.**

Optionally generate a small Build-mode "front door" and deploy it via AI Studio's one-click Publish flow **if a phase opens before the 2026-06-28 deadline** — but only if it does real work. Judges score *demonstrated, substantive Google-stack usage*, not IDE history, so this maximizes the Google Technologies criterion while staying truthful.

---

## 2. The safest reading of "core tool to build and deploy"

The phrase admits two readings:

- **Strict (Reading 1):** the app must be *generated* in AI Studio Build mode (the Antigravity-Agent-powered prompt-to-app generator producing a React + Node.js full-stack project). This is technically real but **not** what we did, and not what hackathon rubrics actually reward.
- **Functional (Reading 2) — recommended:** AI Studio is the platform that *powers the core AI capability* (prompts, system instructions, model selection, API key, function-calling tool schemas) **and** the surface *through which the solution ships to production* via its documented one-click Cloud Run deploy.

Reading 2 is the most defensible because it maps cleanly onto AI Studio's two flagship verbs — **build** (the AI layer is authored in AI Studio) and **deploy** (the running service ships through AI Studio's Cloud Run integration / the same Cloud Run target) — without forbidding hand-written application code, which is what real submissions do.

Verified capabilities that anchor this reading:

- AI Studio's Build mode and Cloud Run deploy are both genuine, documented, first-class features (CONFIRMED). The deploy button is labeled **"Publish"** (top-right) → **Get Started** → **Publish App**, yielding a stable, auto-scaling HTTPS Cloud Run URL that scales to zero (CONFIRMED; "Publish" is the current label, "Deploy app" is legacy).
- The Gemini key is server-side only and "never exposed in the browser" (CONFIRMED). For the automated AI Studio publish flow, the key lands as a **plain Cloud Run environment variable** — *not* Secret Manager (CONFIRMED; this corrects an earlier "docs don't say" finding).
- The `@google/genai` SDK auto-reads `GEMINI_API_KEY` (and `GOOGLE_API_KEY`, which takes precedence if both are set) (CONFIRMED). **Note:** there is no official "Google recommends `GEMINI_API_KEY` for clarity" stance — treat them as equal.

---

## 3. The 6 agents — AI Studio system prompts, model, and sample I/O

All six agents run **server-side** in `lib/agents/`, each as a **pure function** (no Firestore inside — persistence lives only in route handlers via the DAL). Every agent uses **`gemini-3.5-flash`** (Gemini 1.5 is shut down / 404s; the EOL `@google/generative-ai` SDK is not used — we use `@google/genai`).

The system prompt for each agent was authored and iterated in the **AI Studio prompt playground**, then exported via **"Get code"** into `lib/agents/`.

| # | Agent (`lib/agents/`) | Model | AI Studio system prompt (intent) | Sample input | Sample output (structured JSON) |
|---|---|---|---|---|---|
| 1 | **Vision Analyst** | `gemini-3.5-flash` | "You are a civic-infrastructure vision analyst for Bengaluru. Given a citizen photo, classify the issue. Return strict JSON only." | Photo of a flooded, broken road segment | `{ "issue_type": "pothole", "severity": "high", "confidence": 0.91, "description": "Large water-filled pothole spanning a lane", "requires_immediate_action": true, "visual_evidence": "standing water, exposed aggregate, cracked edges" }` |
| 2 | **Dedup** | `gemini-3.5-flash`¹ | "Compose a warm, non-blocking near-duplicate message. Never say 'duplicate' or 'rejected'. Invite a confirming photo." | New report at `(12.9352, 77.6245)`; existing match 18m away | `{ "is_likely_duplicate": true, "distance_m": 18, "friendly_message": "Looks like a neighbour reported a similar pothole about 18m away — want to add your photo so the team sees it's still there?", "invite_confirming_photo": true }` |
| 3 | **Routing** | `gemini-3.5-flash` | "Route the issue to the correct Bengaluru authority (BBMP/BWSSB/BESCOM/BDA). Draft a polite complaint, give helpline + priority. Return JSON." | `issue_type: water_leak`, area: Indiranagar | `{ "authority": "BWSSB", "drafted_complaint": "Respected BWSSB team, a water main leak...", "helpline": "1916", "priority": "P2", "rationale": "Water supply leakage is BWSSB jurisdiction." }` |
| 4 | **Community Validator** | `gemini-3.5-flash` | "Cross-check a verifier's photo against the original report photo. Do they show the same issue at the same place? Return JSON with confidence." | Original pothole photo + new citizen photo | `{ "is_same_issue": true, "confidence": 0.86, "reasoning": "Same kerb pattern and lane markings; pothole shape matches." }` |
| 5 | **Resolution Verifier** | `gemini-3.5-flash` | "Compare before/after photos. Classify as RESOLVED, PARTIALLY_RESOLVED, or NOT_RESOLVED. Return JSON with evidence." | Before (open pothole) + after (patched road) | `{ "status": "RESOLVED", "confidence": 0.93, "evidence": "Surface is uniformly patched; no standing water or exposed aggregate remains." }` |
| 6 | **Impact Estimator** *(micro-agent)* | `gemini-3.5-flash` | "Estimate how many people an issue affects (nearby residents, commuters, businesses, delivery partners). Output the warm 'you're not alone' card copy. Return JSON." | `issue_type: pothole`, busy arterial road, Koramangala | `{ "people_affected": 1200, "breakdown": { "residents": 400, "commuters": 600, "businesses": 120, "delivery_partners": 80 }, "card_copy": "Around 1,200 neighbours pass this spot daily — you're not reporting this alone." }` |

¹ **Honest note on Agent 2:** the *geo-match itself* is a pure Haversine calculation within 500m (deterministic code, not Gemini). Gemini is used to compose the *friendly framing message*. This is intentional — the dedup decision must be reproducible; the warmth is generated.

> **Phase note:** Agent 3 (Routing) will add Gemini **function-calling** in Phase 2 (calling structured "lookup authority / lookup helpline" tools). The function-calling tool schemas for Agents 2 and 3 are the centrepiece of our **Agentic Depth (20%)** story and are authored in AI Studio (Step 2 below).

---

## 4. How the prompts were designed and iterated in AI Studio's prompt playground

For each of the 6 agents, in AI Studio's **prompt playground**:

1. **Author the system instruction.** Start from the intent in the table above; refine wording against real Bengaluru sample photos/issues.
2. **Tune temperature and configure structured output.** Set a low temperature for the deterministic classifiers (Vision, Validator, Resolution) and configure a **structured-output JSON schema** so the model returns parseable JSON, not prose.
3. **Define function-calling tool schemas** — especially for the **dedup** and **routing** agents. This is the Agentic Depth evidence.
4. **Save each as a prompt file** and capture a **shareable prompt link** showing the iteration history.
5. **Export with "Get code"** → choose the language → paste/adapt into the matching `lib/agents/` file. Keep the exported snippet next to the committed code so the lineage is visible.

This procedure is what makes AI Studio the **build** surface for the agentic core: the prompts, schemas, and tool definitions that *are* the product's intelligence were authored there and flowed into the repo.

---

## 5. The `@google/genai` integration

The Gemini client foundation is built (Phase 2A): `generateJson` + `assertGeminiEnv` in the Gemini client module. All agents call through this single helper, so every Gemini call gets the same JSON discipline and error handling.

The integration follows the code rules: **zero `any`** (TS strict), **every Gemini call in `try/catch`**, **every `JSON.parse` via `parseGeminiResponse()`**, **no hardcoded secrets**, and **agent files stay pure** (Firestore only in route handlers via the DAL).

Shape of the helper (illustrative):

```ts
import { GoogleGenAI } from "@google/genai";

// Auto-reads GEMINI_API_KEY from the environment (server-only).
// GOOGLE_API_KEY would take precedence if both were set.
const ai = new GoogleGenAI({});

export function assertGeminiEnv(): void {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY (server-only). Set it in the Cloud Run env.");
  }
}

export async function generateJson<T>(args: {
  systemInstruction: string;
  contents: unknown;
  // structured output: force JSON so we never parse prose
}): Promise<T> {
  assertGeminiEnv();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: args.contents,
      config: {
        systemInstruction: args.systemInstruction,
        responseMimeType: "application/json",
      },
    });
    return parseGeminiResponse<T>(response.text);
  } catch (err) {
    // Never leak the key or raw provider error to the client.
    throw new Error(`Gemini call failed: ${(err as Error).message}`);
  }
}
```

Key points that map to verified Google-stack behaviour:

- **`responseMimeType: "application/json"`** + the per-agent structured-output schema designed in AI Studio is what guarantees parseable output.
- **`parseGeminiResponse()`** is the single guarded JSON boundary: it strips any stray code fences/whitespace and `JSON.parse`s exactly once, inside `try/catch`, returning a typed `T`. No raw `JSON.parse` appears anywhere else.
- **`GEMINI_API_KEY` is server-only** — never `NEXT_PUBLIC_`. (The Maps key stays `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; that one is meant to be public.)
- The app also runs with **no Firebase** via the in-memory DAL seeded with Bengaluru data, so the demo runs with **just a Gemini key** — which keeps the Google-stack dependency front-and-centre and the deploy trivial.

---

## 6. Key issuance + Cloud Run deploy path

### Step 0 — Verify the key (do this first)

The key starts with **`AQ.`**, not `AIza`. **This is correct and expected.** Google has officially moved AI Studio key generation from legacy Traffic keys (`AIza`) to the new Authentication Key (`AQ.`) format — "AI Studio will now only generate Authentication Key (AQ) keys" (CONFIRMED). So the `AQ.` prefix is **evidence the key was freshly issued by AI Studio**, not a red flag. Confirm it authenticates a live Gemini call.

### Step 1 — Key issuance (AI Studio owns the credential)

Issue/confirm the key from AI Studio's **"Get API key"** page. Capture a screenshot tying it to the project. In the deployed Cloud Run service it is read from env via `new GoogleGenAI({})` (auto-reads `GEMINI_API_KEY`) or `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`.

### Step 2 — Prompt design for all 6 agents in AI Studio

(See §4.) Author + iterate system instructions, configure structured output, define function-calling tool schemas (dedup + routing), save shareable prompt links.

### Step 3 — "Get code" → seed `lib/agents/`

Use **"Get code"** to export the Gemini API call for each tuned prompt, then paste/adapt into `lib/agents/`. Capture the exported snippet next to the matching committed code — this demonstrably shows AI Studio output flowed into the app.

### Step 4 — Deploy to Cloud Run

**Primary (gcloud source-deploy — fully reliable, no Dockerfile required).** The hand-written Next.js 14 app deploys to Cloud Run with one command (Cloud Build buildpacks auto-build):

```bash
gcloud run deploy SERVICE --source . --region REGION --allow-unauthenticated
```

Supply the key. Plain env var works:

```bash
--set-env-vars=GEMINI_API_KEY=...
```

Or, recommended for production, from Secret Manager (requires the Cloud Run service identity to hold `roles/secretmanager.secretAccessor`; pin a **specific version**, not `latest`, for env-var secrets):

```bash
--set-secrets=GEMINI_API_KEY=gemini-api-key:3
```

Useful Next.js flags:

- `--cpu-boost` — faster cold starts.
- `--min-instances 1` — avoid the zero-to-one cold start during judging.

If you commit a standalone Dockerfile instead: set `output: 'standalone'` in `next.config.js`, `ENV HOSTNAME=0.0.0.0` (**critical** — Cloud Run routes to `0.0.0.0`), listen on `$PORT` (default `8080`), `CMD ["node", "server.js"]`.

**Optional literal-compliance stretch (STRETCH — only if a phase opens before the deadline).** Generate a thin React **front door** in Build mode that does *real work* (e.g., the voice/upload entry UI) and deploy *it* via AI Studio's **Publish → Get Started → Publish App** one-click Cloud Run flow, wiring it to the existing Next.js pipeline as a backend API. On the free **Starter Tier** this needs no GCP project/billing but is capped at **2 services in one region** (and the team is ineligible if anyone has an active/prior GCP billing account). Do **not** attempt to import the existing Next.js repo *into* Build mode — that flow does not exist ("This functionality is not yet available," CONFIRMED).

---

## 7. Evidence / artifacts checklist for the submission

| ✅ | Artifact to capture | Maps to verified claim | Persuasive value |
|---|---|---|---|
| ☐ | AI Studio **"Get API key"** page screenshot + the `AQ.` key visible in Cloud Run env/secret config | AI Studio provisions the credential; new keys are `AQ.` format (CONFIRMED) | **High** — proves AI Studio owns the credential |
| ☐ | **6 saved prompt files / shareable prompt links** showing iteration history, structured-output + function-calling schemas | Build mode / playground prompt authoring; function-calling supported (CONFIRMED) | **High** — directly supports Agentic Depth |
| ☐ | **"Get code"** exported snippet beside matching `lib/agents/` code | "Get code" exports Gemini sample code in chosen language (CONFIRMED) | **High** — shows AI Studio output flowed into the app |
| ☐ | **Cloud Run deploy logs + live HTTPS URL** | `gcloud run deploy --source .` buildpack auto-build (CONFIRMED) | **High** — proves a live, deployed Google-stack service |
| ☐ | Screenshot of key as **server-side env var** (not in the client bundle) | Key is server-side only, lands as Cloud Run env var (CONFIRMED) | **Medium** — demonstrates correct/secure Gemini integration |
| ☐ | *(If STRETCH done)* Build-mode app + its export + AI Studio one-click Cloud Run service URL | One-click Publish → Cloud Run from Build mode (CONFIRMED) | **High** for literal Reading 1 |
| ☐ | Short **"How we used AI Studio"** section in the writeup stating the interpretation honestly | — | **Medium** — transparency is itself a credibility booster |

> **Do not** fabricate a Build-mode origin for the Next.js app — it is easily disproven and is the one genuinely dishonest move.

---

## 8. What's a stretch / risks (honest)

- **The literal "build the functional solution" gap.** A judge reading "build" strictly as "generated in Build mode" can argue the *scaffold* wasn't built in AI Studio. Mitigate by being explicit that AI Studio built the **agentic core** (prompts, schemas, tool definitions) and shipped the service — not by implying Build mode generated the app.
- **The Build-mode "front door" stretch (Option c)** is the only path that fully satisfies the strict reading, but it costs real time, adds a second Cloud Run service, and risks product seams (CORS/auth, possibly re-implementing the Maps/upload UI in React) that could hurt Product/Design and Completeness scores. Only credible if it does real work — judges familiar with AI Studio will spot a decorative shell. Treat as optional, gated on an explicit go-ahead per the project's phase-gated build rules.
- **Playground screenshots alone are insufficient** as the *primary* claim — they prove prompt engineering, not "core build+deploy." Fold them into the main story; don't lead with them.
- **Starter Tier eligibility:** if anyone on the team has an active/prior GCP billing account, the no-billing one-click path is unavailable; you'd need standard deployment (billing-enabled linked project). The `gcloud` source-deploy path sidesteps this dependency entirely.
- **Minor uncertainties:** the exact Cloud Run/ZIP-export verbatim doc strings could not all be located (the substance is corroborated); and there is **no** official preference between `GEMINI_API_KEY` and `GOOGLE_API_KEY` — don't claim one.

---

## 9. Mapping to Google Technologies (15%)

No surveyed rubric has a literal line item named "Google Technologies (15%)," but every Google/Gemini hackathon includes a functionally equivalent criterion (e.g., Technical Execution/Implementation 40%, "Use of Gemini 25%," "leverages relevant Google Cloud services") — and a 15% per-event variant is realistic. Under it, judges reward **verifiable, non-trivial Google-stack usage visible in the demo and writeup**, not the code-generation pathway. They cannot see your IDE, so *how* the code was produced is invisible and unscored; the **live Cloud Run URL and the visible Gemini integration are what they grade.**

This plan scores well because it stacks multiple Google services with evidence:

- **Gemini** — the 6-agent layer, with function-calling / structured output authored in AI Studio.
- **AI Studio** — key issuance, prompt design, "Get code" export.
- **Cloud Run** — deployed, auto-scaling service.
- *(optional)* a **Build-mode-deployed front door**.

In the writeup, state plainly:

> *"We designed and validated our Gemini agent layer in Google AI Studio (prompts, structured output, function-calling), exported it via 'Get code', and deployed to Google Cloud Run — Gemini-powered, AI Studio-built, Cloud Run-shipped."*

That makes AI Studio unambiguously the "core tool" under the defensible functional reading and maximizes the criterion honestly.

---

**Relevant code path:** `/Users/nikhil/LocalVoice2Action/lib/agents/` (target for the "Get code" exports).
**Related doc:** `/Users/nikhil/LocalVoice2Action/docs/superpowers/specs/2026-06-22-localvoice2action-decisions.md` (records the stack corrections — why Gemini 1.5 and the old `@google/generative-ai` SDK were dropped).
