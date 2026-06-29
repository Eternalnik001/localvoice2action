"use client"

// ============================================================
// NicknamePrompt — Tier 2 inline soft-identity prompt (not a modal/redirect).
// Shown after a successful report. Optional: Save generates an 8-char
// citizenToken, stores it in localStorage (lova_citizen_token), and links it
// to the caller's IP server-side. Skip dismisses. Never blocks anything.
// ============================================================

import { useState } from "react"

const TOKEN_KEY = "lova_citizen_token"
const NICK_KEY = "lova_citizen_nickname"

function randomToken(): string {
  // 8-char base36 string. (crypto.randomUUID exists, but 8 chars is the spec.)
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  const arr = new Uint32Array(8)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 8; i++) out += chars[arr[i]! % chars.length]
  return out
}

export function NicknamePrompt() {
  const [nickname, setNickname] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "saved" | "skipped">(
    "idle"
  )

  // Already has a token → nothing to prompt.
  if (typeof window !== "undefined" && localStorage.getItem(TOKEN_KEY)) {
    return null
  }
  if (state === "skipped") return null

  async function save() {
    const nick = nickname.trim() || "Neighbour"
    setState("saving")
    const token = randomToken()
    try {
      await fetch("/api/register-citizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nickname: nick }),
      })
    } catch {
      // Even if the server link fails, keep the token client-side — harmless.
    }
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(NICK_KEY, nick)
    setState("saved")
  }

  if (state === "saved") {
    return (
      <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
        Saved! Welcome, {nickname.trim() || "Neighbour"} 👋 You can now track
        your badges.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-700">
        Want to track this issue? Pick a nickname — no email needed.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Asha from Koramangala"
          maxLength={40}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setState("skipped")}
          className="text-sm text-slate-400 underline"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

export default NicknamePrompt
