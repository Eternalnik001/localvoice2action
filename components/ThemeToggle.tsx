"use client"

// Floating light/dark toggle, mounted globally in the root layout so it
// appears on every page. Defaults to the visitor's OS theme (via next-themes
// enableSystem) and remembers an explicit choice.

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // resolvedTheme is only known on the client; wait for mount to pick the icon
  // so server and first client render match (no hydration warning).
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      // Offset by the safe-area inset so it clears the iOS status bar / notch.
      style={{
        top: "calc(env(safe-area-inset-top) + 0.75rem)",
        right: "calc(env(safe-area-inset-right) + 0.75rem)",
      }}
      className="fixed z-50 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-slate-700 shadow-lg ring-1 ring-slate-200 backdrop-blur transition hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
    >
      {mounted && isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  )
}

export default ThemeToggle
