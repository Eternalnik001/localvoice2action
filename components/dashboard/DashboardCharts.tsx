"use client"

// ============================================================
// DashboardCharts — recharts client component (sections 2 & 3).
// Recharts uses the DOM, so it must be a client component. Data is computed
// server-side (lib/data/dashboardStats) and passed in as plain arrays.
// ============================================================

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts"
import type { IssueType } from "@/lib/types"
import type {
  CategoryDatum,
  AreaResolutionDatum,
} from "@/lib/data/dashboardStats"

export interface DashboardChartsProps {
  byCategory: CategoryDatum[]
  byArea: AreaResolutionDatum[]
}

// Bar color per issue type.
const TYPE_COLOR: Record<IssueType, string> = {
  POTHOLE: "#DC2626",
  WATER_LEAKAGE: "#2563EB",
  BROKEN_STREETLIGHT: "#F59E0B",
  GARBAGE_OVERFLOW: "#16A34A",
  DAMAGED_FOOTPATH: "#9333EA",
  ENCROACHMENT: "#0891B2",
  OTHER: "#64748B",
  NOT_A_CIVIC_ISSUE: "#94A3B8",
}

export function DashboardCharts({ byCategory, byArea }: DashboardChartsProps) {
  return (
    <>
      {/* Section 2 — issues by category (horizontal bars) */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          What Bengaluru is reporting
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, byCategory.length * 44)}>
          <BarChart
            data={byCategory}
            layout="vertical"
            margin={{ left: 16, right: 24, top: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={90}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {byCategory.map((d) => (
                <Cell key={d.type} fill={TYPE_COLOR[d.type]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Section 3 — resolution rate by area (grouped bars) */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Which areas are getting fixed
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={byArea}
            margin={{ left: 8, right: 16, top: 4, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="area"
              tick={{ fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="open" name="Open" fill="#DC2626" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="resolved"
              name="Resolved"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>
  )
}

export default DashboardCharts
