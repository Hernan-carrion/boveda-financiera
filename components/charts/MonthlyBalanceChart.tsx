"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoneda } from "@/lib/utils";

/**
 * Compara Ingresos vs Egresos del mes actual en un BarChart.
 */
export default function MonthlyBalanceChart({
  ingresos,
  egresos,
}: {
  ingresos: number;
  egresos: number;
}) {
  const data = [
    { name: "Ingresos", valor: ingresos, fill: "#34d399" },
    { name: "Egresos", valor: egresos, fill: "#f87171" },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
            width={72}
            tickFormatter={(v) =>
              new Intl.NumberFormat("es-AR", { notation: "compact" }).format(
                Number(v) || 0,
              )
            }
          />
          <Tooltip
            cursor={{ fill: "#ffffff0a" }}
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              color: "#f4f4f5",
              fontSize: 13,
            }}
            formatter={(v) => [formatMoneda(Number(v) || 0, "ARS"), "Monto"]}
          />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={96}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
