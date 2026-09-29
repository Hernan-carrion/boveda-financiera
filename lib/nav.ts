import {
  Wallet,
  PieChart,
  History,
  CreditCard,
  HandCoins,
  Coins,
  Settings,
  Target,
  Repeat,
  PiggyBank,
  BarChart3,
  Receipt,
  CalendarCheck,
  ListFilter,
  CheckSquare,
  Bell,
  StickyNote,
  Sun,
  Flame,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa único de secciones: lo usan el sidebar (NavBar) y los encabezados de
 * página (PageHeader), así ícono, nombre y color de cada vista coinciden.
 * Dos pilares: Vida en violeta, Finanzas en esmeralda.
 */
export type NavTone = "life" | "money" | "neutral";
export type NavLink = { href: string; label: string; Icon: LucideIcon };

export const navGroups: { label: string; tone: NavTone; links: NavLink[] }[] = [
  {
    label: "Vida",
    tone: "life",
    links: [
      { href: "/hoy", label: "Hoy", Icon: Sun },
      { href: "/tareas", label: "Tareas", Icon: CheckSquare },
      { href: "/habitos", label: "Hábitos", Icon: Flame },
      { href: "/recordatorios", label: "Recordatorios", Icon: Bell },
      { href: "/notas", label: "Notas", Icon: StickyNote },
    ],
  },
  {
    label: "Finanzas",
    tone: "money",
    links: [
      { href: "/", label: "Dashboard", Icon: Wallet },
      { href: "/movimientos", label: "Movimientos", Icon: ListFilter },
      { href: "/presupuestos", label: "Presupuestos", Icon: Target },
      { href: "/metas", label: "Metas", Icon: PiggyBank },
      { href: "/suscripciones", label: "Suscripciones", Icon: Repeat },
      { href: "/sueldo", label: "Cuenta sueldo", Icon: CalendarCheck },
      { href: "/por-cobrar", label: "Por cobrar", Icon: Receipt },
      { href: "/estadisticas", label: "Estadísticas", Icon: BarChart3 },
      { href: "/resumen", label: "Resumen", Icon: PieChart },
      { href: "/historico", label: "Histórico", Icon: History },
      { href: "/tarjetas", label: "Tarjetas", Icon: CreditCard },
      { href: "/prestamos", label: "Préstamos", Icon: HandCoins },
      { href: "/inversiones", label: "Inversiones", Icon: Coins },
    ],
  },
];

/** Clases por pilar: encabezado de grupo, ítem activo, ícono y chip del header. */
export const TONE = {
  life: {
    heading: "text-accent-life",
    active: "bg-violet-500/10 text-violet-200 before:bg-accent-life",
    icon: "text-accent-life",
    chip: "bg-violet-500/10 text-accent-life ring-violet-400/20",
  },
  money: {
    heading: "text-accent",
    active: "bg-emerald-500/10 text-emerald-100 before:bg-accent",
    icon: "text-accent",
    chip: "bg-emerald-500/10 text-accent ring-emerald-400/20",
  },
  neutral: {
    heading: "",
    active: "bg-white/5 text-zinc-50 before:bg-zinc-300",
    icon: "text-zinc-200",
    chip: "bg-white/5 text-zinc-200 ring-white/10",
  },
} as const satisfies Record<NavTone, Record<string, string>>;

export const configLink: NavLink = {
  href: "/configuracion",
  label: "Configuración",
  Icon: Settings,
};

export function buscarSeccion(href: string): { link: NavLink; tone: NavTone } {
  for (const g of navGroups) {
    const link = g.links.find((l) => l.href === href);
    if (link) return { link, tone: g.tone };
  }
  return { link: configLink, tone: "neutral" };
}
