"use client"

// ============================================================
// ErrorBoundary — class component (only class components can catch render
// errors in React). Wrap any client section that could throw so one broken
// widget never takes down the whole page. Never shows raw errors or stack
// traces — just a calm, on-brand "this section couldn't load" card.
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from "react"

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback UI. Defaults to the clean card below. */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to the console for developers; never surface the raw error to users.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught an error:", error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-700">
            This section couldn&apos;t load — the rest of the app is fine.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
