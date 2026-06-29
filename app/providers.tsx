"use client"

// Client-side providers mounted once in the root layout.
// next-themes manages the `.dark` class on <html> + persistence.

import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
