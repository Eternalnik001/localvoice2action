# GO-LIVE CHECKLIST — LocalVoice2Action

> Single ordered sequence to take the app from "code done" to "demo-ready live URL."
> **Deadline: 2026-06-28 20:00 IST.** Do this **at least a day early** so the smoke
> test has room to catch surprises. Full detail for any step is in
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Code is done — nothing below is coding.

Real values for this project (fill the two keys):
- Project ID: `localvoice2action`
- Region: `asia-south1` (Mumbai — closest to Bengaluru)
- Service name: `localvoice2action`

---

## ☐ STEP 0 — Final code sanity (2 min) — *can do now*
```bash
cd /Users/nikhil/LocalVoice2Action
pkill -f "next dev"          # stop dev so it can't clobber .next during build
npx tsc --noEmit            # expect: exit 0
npm run build               # expect: clean, 14 routes
```
✅ Already verified green as of today. Re-run right before deploy.

---

## ☐ STEP 1 — 🔴 Billing-tier Gemini key (THE #1 RISK)
Free tier = ~20 calls/day → **will 429 mid-demo.** Must use a key from a
**billing-enabled** GCP project.
1. GCP Console → APIs & Services → **Credentials → Create credentials → API key**
2. **Restrict** it to the **Generative Language API** (API restrictions)
3. Confirm the key's project has **billing enabled** (billing on the *project* lifts the cap)
4. Put it in `.env.local` as `GEMINI_API_KEY=...` **and** use it in Step 4 below
5. **Verify it works:** `npm run dev`, do one report upload → vision classifies (no 429)

> Expected demo-day cost at ~100 calls: **under ₹50.** Set a budget alert to be safe.

---

## ☐ STEP 2 — gcloud setup (one-time)
```bash
gcloud auth login
gcloud config set project localvoice2action
gcloud config set run/region asia-south1
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

---

## ☐ STEP 3 — (Recommended) Gemini key into Secret Manager
Keeps the key out of plain env. Skip to Step 4's plain-env form if you want the
fastest path, but this is better practice.
```bash
printf 'YOUR_BILLING_GEMINI_KEY' | gcloud secrets create gemini-api-key --data-file=-
# Grant the Cloud Run runtime service account read access:
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:$(gcloud projects describe localvoice2action --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## ☐ STEP 4 — Deploy to Cloud Run
**The Maps key is inlined at BUILD time** (it's `NEXT_PUBLIC_`), so it must be
present during the Cloud Build. `--source .` builds in the cloud and uses the
repo `Dockerfile` automatically.

**Option A — Secret Manager key (if you did Step 3):**
```bash
gcloud run deploy localvoice2action \
  --source . --region asia-south1 --allow-unauthenticated \
  --min-instances 1 --max-instances 2 --memory 512Mi --cpu 1 \
  --timeout 30 --cpu-boost \
  --set-env-vars=NODE_ENV=production,GEMINI_MODEL=gemini-3.5-flash,NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_MAPS_KEY \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:1
```

**Option B — plain env key (fastest):**
```bash
gcloud run deploy localvoice2action \
  --source . --region asia-south1 --allow-unauthenticated \
  --min-instances 1 --max-instances 2 --memory 512Mi --cpu 1 \
  --timeout 30 --cpu-boost \
  --set-env-vars=NODE_ENV=production,GEMINI_MODEL=gemini-3.5-flash,GEMINI_API_KEY=YOUR_BILLING_GEMINI_KEY,NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_MAPS_KEY
```

> `--min-instances 1` keeps one warm instance so the live demo never cold-starts.
> **Set it back to 0 after the demo** to avoid idle billing.

Get the URL:
```bash
gcloud run services describe localvoice2action --region asia-south1 --format='value(status.url)'
```

---

## ☐ STEP 5 — 🟠 Restrict the Maps key (now that you have a public URL)
GCP Console → Credentials → your Maps key:
- **Application restriction:** HTTP referrers → `https://YOUR-CLOUD-RUN-URL/*` + `http://localhost:3000/*`
- **API restriction:** Maps JavaScript API + Maps Static API + Geocoding API only
- **Quota cap** on each so it can't bill past the free tier

---

## ☐ STEP 6 — Smoke test the live URL (your eyeballs — I can't do this)
Open the Cloud Run URL in a browser and confirm, in order:
- ☐ `curl -I https://YOUR-URL` → 200
- ☐ Home **map** loads with Bengaluru pins (Maps key works in browser)
- ☐ Dashboard **charts** render + **AI insight cards** appear (no blank panels)
- ☐ Report flow: upload photo → vision classifies (proves billing key live, **no 429**)
- ☐ Dedup "same issue ~Xm away" card fires (never says "duplicate/rejected")
- ☐ Issue detail: before/after slider + "people affected" card render
- ☐ **No key leakage:** view-source / network tab → `GEMINI_API_KEY` must NOT appear
- ☐ Mobile: open in phone / DevTools 390px → map→list, strip stacks, buttons tappable
- ☐ Logs clean: `gcloud run services logs read localvoice2action --region asia-south1 --limit 50`

---

## ☐ STEP 7 — Submission package
- ☐ Live Cloud Run URL pasted into the submission form
- ☐ Repo link (incl. `docs/` + `DEMO_SCRIPT.md` + `docs/AI_STUDIO_AND_GEMINI.md` compliance proof)
- ☐ Demo video recorded following [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- ☐ AI Studio evidence captured (prompt playground screenshots, "Get code" export note)

---

## ☐ STEP 8 — After the demo
- ☐ `gcloud run services update localvoice2action --region asia-south1 --min-instances 0` (stop idle billing)
- ☐ Confirm no runaway spend in Billing

---

### The 3 things that will actually bite you (in order)
1. **Free Gemini key → 429 mid-demo.** Step 1. Non-negotiable.
2. **Maps key blank/unrestricted.** Inlined at build (Step 4), restricted after (Step 5).
3. **Cold start on a zero-instance service during judging.** `--min-instances 1` for the demo window (Step 4).
