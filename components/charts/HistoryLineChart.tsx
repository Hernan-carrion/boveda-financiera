"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMoneda } from "@/lib/utils";
import { EmptyState } from "@/components/ui";

export interface HistoryPoint {
  mes: string;
  patrimonio: number;
  ingresos: number;
  gastos: number;
}

/**
 * Evolución histórica mes a mes: patrimonio neto (línea principal) más
 * ingresos y gastos. Todo en ARS.
 */
export default function HistoryLineChart({ data }: { data: HistoryPoint[] }) {
  if (data.length === 0) {
    return <EmptyState>Sin historial suficiente para graficar.</EmptyState>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#ffffff12" vertical={false} />
          <XAxis
            dataKey="mes"
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
            contentStyle={{
              background: "#0b0b10",
              border: "1px solid #ffffff1a",
              borderRadius: 10,
              color: "#f4f4f5",
              fontSize: 12,
            }}
            formatter={(v, name) => [
              formatMoneda(Number(v) || 0, "ARS"),
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <Line
            type="monotone"
            dataKey="patrimonio"
            name="Patrimonio"
            stroke="#60a5fa"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="#4ade80"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="gastos"
            name="Gastos"
            stroke="#fb7185"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
