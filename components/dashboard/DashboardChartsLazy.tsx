"use client"

// ============================================================
// DashboardChartsLazy — client wrapper that lazy-loads the recharts charts.
// next/dynamic with ssr:false keeps the ~100kB recharts bundle OUT of the
// dashboard's initial load; it's fetched only in the browser after first paint.
// A light skeleton holds the layout while it loads.
// ============================================================

import dynamic from "next/dynamic"
import type { DashboardChartsProps } from "@/components/dashboard/DashboardCharts"

const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 space-y-6">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    ),
  }
)

export function DashboardChartsLazy(props: DashboardChartsProps) {
  return <DashboardCharts {...props} />
}

export default DashboardChartsLazy
