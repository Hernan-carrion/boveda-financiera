import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para la sincronización opcional en la nube.
 *
 * La app es local-first: si las variables NEXT_PUBLIC_SUPABASE_* no están
 * definidas, `supabase` es `null` y todo sigue funcionando contra IndexedDB.
 * Como el export es estático, las env vars se inyectan en tiempo de build.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
