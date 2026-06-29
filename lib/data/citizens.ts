// ============================================================
// Tier 2 — soft anonymous identity (nicknames). In-memory ONLY.
//
// Links an optional citizenToken (random string, lives in the client's
// localStorage) to the reporter's anonymous IP-hash, plus a nickname. Lets a
// citizen "claim" the badges their IP earned, without any account or email.
//
// Badge link is session-durable but not permanent — IP change or server
// restart resets it. Acceptable for demo scope. NO persistence layer is added
// to fix this — no Firebase, no cookies, no DB — the in-memory limitation is
// intentional and keeps cost at ₹0.
// ============================================================

interface Citizen {
  token: string
  ipHash: string
  nickname: string
}

// token → citizen, and ipHash → token (for reverse lookup by caller IP).
// Stashed on globalThis so Next.js dev hot-reload doesn't wipe them per edit.
const g = globalThis as unknown as {
  __lova_citizensByToken?: Map<string, Citizen>
  __lova_tokenByIp?: Map<string, string>
}
const byToken = (g.__lova_citizensByToken ??= new Map<string, Citizen>())
const tokenByIp = (g.__lova_tokenByIp ??= new Map<string, string>())

/** Link a citizenToken + nickname to an anonymous IP-hash. */
export function registerCitizenToken(
  token: string,
  ipHash: string,
  nickname: string
): void {
  const clean = nickname.trim().slice(0, 40) || "Neighbour"
  byToken.set(token, { token, ipHash, nickname: clean })
  tokenByIp.set(ipHash, token)
}

/** The citizenToken linked to this IP-hash, if any (null after restart / IP change). */
export function tokenForIp(ipHash: string): string | null {
  return tokenByIp.get(ipHash) ?? null
}

/** Nickname for a citizenToken, if registered. */
export function nicknameForToken(token: string): string | null {
  return byToken.get(token)?.nickname ?? null
}

/** Nickname for an IP-hash (via its linked token), if any. Powers the leaderboard. */
export function nicknameForIp(ipHash: string): string | null {
  const token = tokenByIp.get(ipHash)
  return token ? byToken.get(token)?.nickname ?? null : null
}
