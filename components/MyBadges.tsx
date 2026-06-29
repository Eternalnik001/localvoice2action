"use client"

// ============================================================
// MyBadges — Tier 2 badge display (client). Shows the viewer's own earned
// badges when they've saved a nickname (localStorage citizenToken). If not,
// shows a subtle "save a nickname to see them" prompt. Never blocks anything.
// Used on the issue detail page and the dashboard.
// ============================================================

import { useEffect, useState } from "react"

const TOKEN_KEY = "lova_citizen_token"

interface BadgeLite {
  id: string
  label: string
  emoji: string
}

export function MyBadges() {
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [badges, setBadges] = useState<BadgeLite[]>([])
  const [nickname, setNickname] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    setHasToken(Boolean(token))
    if (!token) return
    fetch("/api/my-badges")
      .then((r) => r.json())
      .then((d: { badges?: BadgeLite[]; nickname?: string; reason?: string }) => {
        if (d.reason === "session_expired") {
          setExpired(true)
          return
        }
        setBadges(d.badges ?? [])
        setNickname(d.nickname ?? null)
      })
      .catch(() => setExpired(true))
  }, [])

  // SSR / first paint: render nothing until we know the client state.
  if (hasToken === null) return null

  // No saved nickname (or the session link expired) → subtle invite, never a block.
  if (!hasToken || expired) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        🏅 You&apos;ve earned badges — save a nickname to see them.
      </p>
    )
  }

  if (badges.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-400">
        {nickname ? `Hi ${nickname} — ` : ""}report or confirm issues to earn
        badges.
      </p>
    )
  }

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-slate-700">
        {nickname ? `${nickname}'s badges` : "Your badges"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {badges.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
          >
            <span aria-hidden>{b.emoji}</span>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default MyBadges
