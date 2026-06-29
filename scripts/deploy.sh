#!/usr/bin/env bash
# ============================================================
# LocalVoice2Action — Cloud Run deploy (hackathon submission link).
# Deploys the full Next.js app to Cloud Run from source (uses the Dockerfile).
#
#   - Maps key: baked at BUILD time via the Dockerfile ARG (public client key).
#   - Gemini key: injected at RUNTIME from .env.local (real secret, never baked).
#   - Zero-cost guards: scale-to-zero (min 0), max 2 instances, 512Mi.
#
# Run from the repo root:  bash scripts/deploy.sh
# ============================================================
set -euo pipefail

# ---- Config (edit if needed) ----
ACCOUNT="nikhilta24@gmail.com"     # PERSONAL account (never the work onequince one)
PROJECT_ID="localvoice2action-ac21c"   # the hackathon GCP project (#429331672736)
REGION="asia-south1"               # Mumbai — closest to Bengaluru
SERVICE="localvoice2action"

echo "==> Using personal account ${ACCOUNT}"
gcloud config set account "${ACCOUNT}"

# ---- Read the server-only Gemini key from .env.local (never printed) ----
GEMINI_KEY="$(grep -E '^GEMINI_API_KEY=' .env.local | cut -d= -f2-)"
GEMINI_MODEL_VAL="$(grep -E '^GEMINI_MODEL=' .env.local | cut -d= -f2- || echo 'gemini-3.5-flash')"
if [ -z "${GEMINI_KEY}" ]; then
  echo "ERROR: GEMINI_API_KEY not found in .env.local" >&2
  exit 1
fi

echo "==> Setting project to ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

echo "==> Confirming billing is enabled"
gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' || true

echo "==> Enabling required APIs (run, cloudbuild, artifactregistry)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Optional Firestore mode (no service-account key needed — uses ADC on Cloud Run):
#   USE_FIRESTORE=1 SEED_TOKEN=some-long-secret bash scripts/deploy.sh
USE_FIRESTORE="${USE_FIRESTORE:-0}"
SEED_TOKEN="${SEED_TOKEN:-}"

ENV_VARS="GEMINI_API_KEY=${GEMINI_KEY},GEMINI_MODEL=${GEMINI_MODEL_VAL}"
if [ "${USE_FIRESTORE}" = "1" ]; then
  ENV_VARS="${ENV_VARS},USE_FIRESTORE=1"
  echo "==> Firestore mode ON (Application Default Credentials)"
fi
if [ -n "${SEED_TOKEN}" ]; then
  ENV_VARS="${ENV_VARS},SEED_TOKEN=${SEED_TOKEN}"
fi

echo "==> Deploying ${SERVICE} to Cloud Run (${REGION}) from source"
gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "${ENV_VARS}"

echo
echo "==> Deployed. Public URL:"
gcloud run services describe "${SERVICE}" --region "${REGION}" --format='value(status.url)'
