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
 * Ingresos (Cash In) vs Gastos (Cash Out) del mes, en barras dark-mode.
 */
export default function IncomeExpenseChart({
  ingresos,
  gastos,
}: {
  ingresos: number;
  gastos: number;
}) {
  const data = [
    { name: "Cash In", valor: ingresos, fill: "#4ade80" },
    { name: "Cash Out", valor: gastos, fill: "#fb7185" },
  ];

  return (
    <div className="h-full min-h-[13rem] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="#ffffff12"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v) =>
              new Intl.NumberFormat("es-AR", { notation: "compact" }).format(
                Number(v) || 0,
              )
            }
          />
          <Tooltip
            cursor={{ fill: "#ffffff08" }}
            contentStyle={{
              background: "#0b0b10",
              border: "1px solid #ffffff1a",
              borderRadius: 10,
              color: "#f4f4f5",
              fontSize: 12,
            }}
            formatter={(v) => [formatMoneda(Number(v) || 0, "ARS"), "Monto"]}
          />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={72}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
