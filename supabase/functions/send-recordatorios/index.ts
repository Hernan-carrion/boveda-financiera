// Supabase Edge Function: send-recordatorios
//
// Corre server-side (Deno), disparada por un cron de pg_cron todos los días
// a las 8hs de Argentina (11:00 UTC, sin horario de verano). Revisa los
// recordatorios activos, decide cuáles corresponden avisar hoy (mismo
// algoritmo que lib/recordatorios.ts + lib/actions.ts del lado cliente) y les
// manda una notificación push real a todos los dispositivos suscriptos.
//
// No requiere ninguna secret nueva además de las que Supabase ya inyecta
// automáticamente (SUPABASE_URL, SUPABASE_ANON_KEY) — sólo hay que setear
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_CONTACT_EMAIL. Ver README.md
// en esta misma carpeta para los pasos de deploy.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { addMonths, addYears, differenceInCalendarDays, parseISO } from "npm:date-fns@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL")!;

webpush.setVapidDetails(
  `mailto:${VAPID_CONTACT_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

interface Recordatorio {
  id: number;
  titulo: string;
  fecha: string; // yyyy-MM-dd
  repetir: "ninguna" | "mensual" | "anual";
  dias_aviso: number;
  activo: boolean;
  eliminado: boolean | null;
  ultimo_push_fecha: string | null;
}

interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** "yyyy-MM-dd" de hoy en horario de Argentina (UTC-3, sin DST). */
function hoyArgentinaISO(): string {
  const ahoraUtc = new Date();
  const ars = new Date(ahoraUtc.getTime() - 3 * 60 * 60 * 1000);
  const y = ars.getUTCFullYear();
  const m = String(ars.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ars.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diasHasta(fecha: string, hoyISO: string): number {
  return differenceInCalendarDays(parseISO(fecha), parseISO(hoyISO));
}

function proximaFecha(fecha: string, repetir: "mensual" | "anual"): string {
  const base = parseISO(fecha);
  const siguiente = repetir === "mensual" ? addMonths(base, 1) : addYears(base, 1);
  return siguiente.toISOString().slice(0, 10);
}

// Mismo algoritmo que lib/recordatorios.ts::avanzarSiVencida del cliente.
function avanzarSiVencida(fecha: string, repetir: Recordatorio["repetir"], hoyISO: string): string {
  if (repetir === "ninguna") return fecha;
  let actual = fecha;
  let guard = 0;
  while (diasHasta(actual, hoyISO) < 0 && guard < 1000) {
    actual = proximaFecha(actual, repetir);
    guard += 1;
  }
  return actual;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const hoyISO = hoyArgentinaISO();

  const { data: recordatorios, error: errRec } = await supabase
    .from("recordatorios")
    .select("id, titulo, fecha, repetir, dias_aviso, activo, eliminado, ultimo_push_fecha")
    .eq("activo", true)
    .or("eliminado.is.null,eliminado.eq.false")
    .returns<Recordatorio[]>();

  if (errRec) {
    return new Response(JSON.stringify({ ok: false, error: errRec.message }), { status: 500 });
  }

  const paraAvisar: { id: number; titulo: string; fechaVigente: string }[] = [];

  for (const r of recordatorios ?? []) {
    const fechaVigente = avanzarSiVencida(r.fecha, r.repetir, hoyISO);
    const dias = diasHasta(fechaVigente, hoyISO);
    const corresponde = dias >= 0 && dias <= r.dias_aviso;
    const yaAvisado = r.ultimo_push_fecha === fechaVigente;

    if (fechaVigente !== r.fecha || (corresponde && !yaAvisado)) {
      await supabase
        .from("recordatorios")
        .update({
          fecha: fechaVigente,
          ultimo_push_fecha: corresponde ? fechaVigente : r.ultimo_push_fecha,
          last_updated: new Date().toISOString(),
        })
        .eq("id", r.id);
    }

    if (corresponde && !yaAvisado) {
      paraAvisar.push({ id: r.id, titulo: r.titulo, fechaVigente });
    }
  }

  if (paraAvisar.length === 0) {
    return new Response(JSON.stringify({ ok: true, avisados: 0 }), { status: 200 });
  }

  const { data: subs, error: errSubs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .returns<PushSubscriptionRow[]>();

  if (errSubs) {
    return new Response(JSON.stringify({ ok: false, error: errSubs.message }), { status: 500 });
  }

  let enviados = 0;
  for (const sub of subs ?? []) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    for (const r of paraAvisar) {
      const payload = JSON.stringify({
        title: "👣 Huella",
        body: r.titulo,
        url: "/boveda-financiera/recordatorios/",
      });
      try {
        await webpush.sendNotification(pushSub, payload);
        enviados += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Suscripción vencida/inválida — se borra para no reintentar en vano.
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, avisados: paraAvisar.length, notificacionesEnviadas: enviados }),
    { status: 200 },
  );
});
