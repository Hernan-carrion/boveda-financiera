"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CategoryDatum } from "@/lib/metrics";
import { formatMoneda } from "@/lib/utils";
import { EmptyState } from "@/components/ui";

const PALETA = [
  "#60a5fa",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
  "#4ade80",
  "#c084fc",
];

/**
 * Distribución de gastos del mes por categoría, con tooltip y leyenda.
 */
export default function CategoryPieChart({ data }: { data: CategoryDatum[] }) {
  if (data.length === 0) {
    return <EmptyState>Sin egresos este mes para graficar.</EmptyState>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius="45%"
            paddingAngle={2}
            stroke="#18181b"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={PALETA[i % PALETA.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              color: "#f4f4f5",
              fontSize: 13,
            }}
            formatter={(v, name) => [
              formatMoneda(Number(v) || 0, "ARS"),
              String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
