import type { Config } from "tailwindcss"

// ============================================================
// LocalVoice2Action — Tailwind theme.
// Brand: "Every voice. Every street. Every fix."
// Semantic tokens so components never hardcode hex values.
// ============================================================

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "#1D4ED8", // blue-700 — primary
          primary: "#1D4ED8",
          accent: "#F59E0B", // amber-500 — accent / CTA
        },
        // Resolution / success
        resolved: "#10B981",
        // Severity scale
        severity: {
          critical: "#DC2626",
          high: "#EA580C",
          medium: "#D97706",
          low: "#65A30D",
        },
        // Issue status
        status: {
          open: "#3B82F6",
          acknowledged: "#8B5CF6",
          in_progress: "#F59E0B",
          resolved: "#10B981",
          closed: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        // CRITICAL-severity pin pulse + flashcard slide-up fallback (no framer-motion needed)
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.3)", opacity: "0" },
          "100%": { transform: "scale(1.3)", opacity: "0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slide-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
}

export default config
