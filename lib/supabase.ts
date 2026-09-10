import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para la sincronización opcional en la nube.
 *
 * La app es local-first: si las variables NEXT_PUBLIC_SUPABASE_* no están
 * definidas, `supabase` es `null` y todo sigue funcionando contra IndexedDB.
 * Como el export es estático, las env vars se inyectan en tiempo de build.
 */

/**
 * Acepta que peguen la "Project URL" o la "REST URL": normaliza
 * `https://xxx.supabase.co/rest/v1/` → `https://xxx.supabase.co`.
 */
function normalizarUrl(u?: string): string | undefined {
  if (!u) return undefined;
  return u
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "")
    .replace(/\/+$/, "");
}

const url = normalizarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anonKey as string, {
      auth: {
        // Uso anónimo (anon key). No hay flujo de login en la app.
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export default supabase;
