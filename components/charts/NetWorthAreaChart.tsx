"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyPoint } from "@/lib/historical";
import { formatMoneda } from "@/lib/utils";

/**
 * Evolución diaria del patrimonio neto del mes seleccionado.
 * Adaptado a dark mode: grilla tenue, degradado eléctrico, tooltip oscuro.
 * `compact` la reduce a un sparkline sin ejes para usarla dentro de una tarjeta.
 */
export default function NetWorthAreaChart({
  data,
  compact = false,
}: {
  data: DailyPoint[];
  compact?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-full min-h-[6rem] place-items-center text-xs text-zinc-600">
        Sin datos para este mes
      </div>
    );
  }

  return (
    <div className={compact ? "h-24 w-full" : "h-full min-h-[16rem] w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={
            compact
              ? { top: 4, right: 0, bottom: 0, left: 0 }
              : { top: 10, right: 8, bottom: 0, left: 8 }
          }
        >
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>

          {!compact && (
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="#ffffff12"
              vertical={false}
            />
          )}
          {!compact && (
            <XAxis
              dataKey="dia"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={16}
            />
          )}
          {!compact && (
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
          )}
          <Tooltip
            cursor={{ stroke: "#3b82f6", strokeOpacity: 0.4 }}
            contentStyle={{
              background: "#0b0b10",
              border: "1px solid #ffffff1a",
              borderRadius: 10,
              color: "#f4f4f5",
              fontSize: 12,
            }}
            labelFormatter={(l) => `Día ${l}`}
            formatter={(v) => [formatMoneda(Number(v) || 0, "ARS"), "Patrimonio"]}
          />
          <Area
            type="monotone"
            dataKey="patrimonio"
            stroke="#60a5fa"
            strokeWidth={2}
            fill="url(#nwFill)"
            dot={false}
            activeDot={{ r: 3, fill: "#60a5fa", stroke: "#0b0b10" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
