import { supabase, supabaseEnabled } from "./supabase";

/**
 * Notificaciones push (Web Push) para recordatorios.
 *
 * Requiere Supabase configurado: la suscripción push (endpoint + claves del
 * navegador) se guarda directo en la tabla `push_subscriptions` — es la
 * única tabla de la app que NO pasa por Dexie/sync, porque no tiene sentido
 * localmente (una suscripción push es del navegador que la generó, no un
 * dato de negocio que haya que sincronizar entre dispositivos).
 *
 * El envío real corre server-side (Supabase Edge Function + cron), fuera de
 * esta app — ver supabase/functions/send-recordatorios/README.md.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const pushSupported =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  !!VAPID_PUBLIC_KEY;

export type EstadoPush = "no-soportado" | "sin-activar" | "denegado" | "activo";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSupported) return "no-soportado";
  if (typeof Notification === "undefined") return "no-soportado";
  if (Notification.permission === "denied") return "denegado";

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "activo" : "sin-activar";
}

export async function activarPush(): Promise<{ ok: boolean; mensaje: string }> {
  if (!pushSupported) {
    return { ok: false, mensaje: "Este navegador no soporta notificaciones push." };
  }
  if (!supabaseEnabled || !supabase) {
    return {
      ok: false,
      mensaje: "Activá primero la sincronización con Supabase en Configuración.",
    };
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    return { ok: false, mensaje: "No diste permiso de notificaciones." };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return { ok: false, mensaje: `No se pudo guardar la suscripción: ${error.message}` };
  }

  return { ok: true, mensaje: "Notificaciones activadas ✓" };
}

export async function desactivarPush(): Promise<void> {
  if (!pushSupported) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (supabase) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}
