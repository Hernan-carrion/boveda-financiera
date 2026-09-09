import type { Moneda, TipoTransaccion } from "./db";

/**
 * Motor de categorización 100% determinista (sin IA / sin red).
 * Toma una frase escrita rápido ("cargue 5000 de nafta en la ypf con mp")
 * y devuelve una transacción estructurada lista para guardar en Dexie.
 */

export interface ResultadoGasto {
  monto: number;
  moneda: Moneda;
  cuenta: string; // nombre exacto de una cuenta sembrada por bovedaDB
  tipo: TipoTransaccion;
  categoria: string;
  descripcion: string;
  textoOriginal: string;
}

/** Normaliza: minúsculas + sin tildes (la ñ pasa a n) para poder matchear. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Extrae el primer número del texto. Soporta:
 *  - "1.500,50"  -> 1500.5   (formato es-AR: punto miles, coma decimal)
 *  - "1500.50"   -> 1500.5
 *  - "1500"      -> 1500
 *  - "20k" / "20 k" -> 20000
 */
function extraerMonto(texto: string): number {
  const conK = texto.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (conK) {
    return Math.round(parseFloat(conK[1].replace(",", ".")) * 1000);
  }

  const match = texto.match(/\d[\d.,]*/);
  if (!match) return 0;

  let token = match[0].replace(/[.,]+$/, "");

  if (token.includes(".") && token.includes(",")) {
    // es-AR: el punto es separador de miles, la coma es decimal
    token = token.replace(/\./g, "").replace(",", ".");
  } else if (token.includes(",")) {
    // solo coma -> decimal
    token = token.replace(",", ".");
  } else if (token.includes(".")) {
    const partes = token.split(".");
    const ultimaEsDecimal =
      partes.length === 2 && partes[1].length > 0 && partes[1].length <= 2;
    token = ultimaEsDecimal ? token : token.replace(/\./g, "");
  }

  const valor = parseFloat(token);
  return Number.isFinite(valor) ? valor : 0;
}

/**
 * Devuelve true si alguna palabra clave está presente. Las claves de una sola
 * palabra se buscan con límite de palabra (evita que "mp" matchee "compre");
 * las frases con espacio se buscan como substring.
 */
function contiene(texto: string, claves: string[]): boolean {
  return claves.some((claveRaw) => {
    const clave = normalizar(claveRaw);
    if (clave.includes(" ")) return texto.includes(clave);
    const escapada = clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escapada}(?:$|[^a-z0-9])`, "i").test(texto);
  });
}

const DICC_CUENTAS: { nombre: string; claves: string[] }[] = [
  { nombre: "Mercado Pago", claves: ["mp", "qr", "transferencia", "mercado pago"] },
  { nombre: "Efectivo Dólares", claves: ["usd", "dolares", "dolar", "u$s"] },
  { nombre: "Efectivo Pesos", claves: ["efectivo", "cash", "plata"] },
];

const DICC_TIPOS: { tipo: TipoTransaccion; claves: string[] }[] = [
  { tipo: "ingreso", claves: ["cobre", "cobré", "sueldo", "ingreso", "me pagaron"] },
  { tipo: "prestamo", claves: ["preste", "presté", "prestar", "le di prestado"] },
  { tipo: "devolucion", claves: ["devolvio", "devolvió", "me devolvio", "devolucion"] },
];

const DICC_CATEGORIAS: { categoria: string; claves: string[] }[] = [
  { categoria: "Vehículo", claves: ["nafta", "ypf", "repuesto auto", "auto", "gnc", "cubierta"] },
  { categoria: "Moto", claves: ["casco", "moto"] },
  {
    categoria: "Herramientas/Trabajo",
    claves: ["estaño", "soldador", "alarma", "pantalla", "herramienta", "taller"],
  },
  {
    categoria: "Deporte/Ocio",
    claves: ["futbol", "fútbol", "pesas", "gimnasio", "gym", "pejerrey", "señuelo", "pesca"],
  },
  { categoria: "Salidas", claves: ["sofi", "cine", "cena", "bar", "boliche", "salida"] },
  { categoria: "Comida", claves: ["chino", "super", "supermercado", "carne", "carniceria", "verduleria"] },
];

const CUENTA_DEFAULT = "Efectivo Pesos";

export function procesarTextoGasto(texto: string): ResultadoGasto {
  const original = texto ?? "";
  const t = normalizar(original);

  const monto = extraerMonto(t);

  const cuentaMatch = DICC_CUENTAS.find((c) => contiene(t, c.claves));
  const cuenta = cuentaMatch?.nombre ?? CUENTA_DEFAULT;

  const moneda: Moneda = cuenta === "Efectivo Dólares" ? "USD" : "ARS";

  const tipoMatch = DICC_TIPOS.find((x) => contiene(t, x.claves));
  const tipo: TipoTransaccion = tipoMatch?.tipo ?? "egreso";

  const categoriaMatch = DICC_CATEGORIAS.find((c) => contiene(t, c.claves));
  const categoria =
    categoriaMatch?.categoria ??
    (tipo === "ingreso"
      ? "Ingresos"
      : tipo === "prestamo" || tipo === "devolucion"
        ? "Préstamos"
        : "Sin categoría");

  return {
    monto,
    moneda,
    cuenta,
    tipo,
    categoria,
    descripcion: original.trim(),
    textoOriginal: original,
  };
}

export const CATEGORIAS_DISPONIBLES = [
  "Vehículo",
  "Moto",
  "Herramientas/Trabajo",
  "Deporte/Ocio",
  "Salidas",
  "Comida",
  "Ingresos",
  "Préstamos",
  "Sin categoría",
];

export default procesarTextoGasto;
