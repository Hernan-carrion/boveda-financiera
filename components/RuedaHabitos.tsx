"use client";

import type { Habito } from "@/lib/db";
import type { DiaCalendarioHabito } from "@/lib/habitos";

/**
 * Rueda circular de hábitos: cada anillo es un hábito, cada gajo un día del
 * mes. Arranca en el día 1 arriba (12 en punto) y barre 270° en sentido
 * horario hasta el día 31 a la izquierda (9 en punto) — el cuarto restante
 * del círculo queda abierto para las etiquetas de cada hábito, en línea
 * recta, tal como en un tracker circular de papel.
 */

const RADIO_INTERNO = 58;
const ANCHO_ANILLO = 32;
const SEPARACION_ANILLO = 3;
const ANGULO_INICIO = -90;
const ANGULO_FIN = 180;
const ANCHO_ETIQUETA = 132;
const MARGEN = 26;

function polar(cx: number, cy: number, r: number, anguloDeg: number) {
  const rad = (anguloDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pathCelda(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r2, a1);
  const p3 = polar(cx, cy, r2, a2);
  const p4 = polar(cx, cy, r1, a2);
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r2} ${r2} 0 0 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${r1} ${r1} 0 0 0 ${p1.x} ${p1.y} Z`;
}

export default function RuedaHabitos({
  habitos,
  celdas,
  mapaPorHabito,
  onTocar,
}: {
  habitos: Habito[];
  celdas: DiaCalendarioHabito[];
  /** habito_id -> (fecha -> hecho) */
  mapaPorHabito: Map<number, Map<string, boolean>>;
  onTocar: (habitoId: number, fecha: string) => void;
}) {
  const nDias = celdas.length || 1;
  const anguloPorDia = (ANGULO_FIN - ANGULO_INICIO) / nDias;
  const nAnillos = Math.max(habitos.length, 1);
  const radioExterno = RADIO_INTERNO + nAnillos * (ANCHO_ANILLO + SEPARACION_ANILLO);

  const cx = MARGEN + ANCHO_ETIQUETA + radioExterno;
  const cy = MARGEN + radioExterno;
  const width = cx + radioExterno + MARGEN + 20;
  const height = cy + radioExterno + MARGEN;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {/* números de día en el borde exterior */}
      {celdas.map((c, di) => {
        const mid = ANGULO_INICIO + (di + 0.5) * anguloPorDia;
        const p = polar(cx, cy, radioExterno + 14, mid);
        return (
          <text
            key={`n-${c.fecha}`}
            x={p.x}
            y={p.y}
            fontSize="10"
            fill="#71717a"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {c.numero}
          </text>
        );
      })}

      {habitos.map((h, i) => {
        const r1 = RADIO_INTERNO + i * (ANCHO_ANILLO + SEPARACION_ANILLO);
        const r2 = r1 + ANCHO_ANILLO;
        const mapa = mapaPorHabito.get(h.id ?? -1) ?? new Map<string, boolean>();
        const yEtiqueta = cy - (r1 + r2) / 2;

        return (
          <g key={h.id}>
            <line
              x1={cx - ANCHO_ETIQUETA}
              y1={yEtiqueta}
              x2={cx}
              y2={yEtiqueta}
              stroke="#3f3f46"
              strokeWidth={1}
            />
            <text
              x={cx - ANCHO_ETIQUETA + 4}
              y={yEtiqueta - 5}
              fontSize="11"
              fill="#d4d4d8"
            >
              {h.nombre.length > 22 ? `${h.nombre.slice(0, 21)}…` : h.nombre}
            </text>

            {celdas.map((c, di) => {
              const a1 = ANGULO_INICIO + di * anguloPorDia;
              const a2 = a1 + anguloPorDia;
              const hecho = mapa.get(c.fecha) ?? false;
              return (
                <path
                  key={c.fecha}
                  d={pathCelda(cx, cy, r1, r2, a1, a2)}
                  fill={hecho ? h.color_hex : "#18181b"}
                  stroke="#27272a"
                  strokeWidth={1}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => h.id != null && onTocar(h.id, c.fecha)}
                >
                  <title>
                    {h.nombre} · día {c.numero}
                  </title>
                </path>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
