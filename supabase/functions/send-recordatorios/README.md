# Deploy de `send-recordatorios`

Esta función manda las notificaciones push reales de los recordatorios
(corre server-side, no depende de que la app esté abierta). El código ya
está en este repo (`index.ts`), pero **el deploy hay que hacerlo desde tu
cuenta de Supabase** — Claude no tiene acceso a ella, solo a la `anon key`
pública que ya usa la app.

Elegí una de las dos formas. La del Dashboard no requiere instalar nada.

## Opción A — Dashboard de Supabase (sin instalar nada)

1. Entrá a tu proyecto en [supabase.com/dashboard](https://supabase.com/dashboard) → **Edge Functions** → **Create a new function**.
2. Nombre: `send-recordatorios`.
3. Pegá el contenido completo de `index.ts` (este mismo folder) en el editor.
4. Deploy.
5. Andá a **Edge Functions → send-recordatorios → Secrets** y agregá:
   - `VAPID_PUBLIC_KEY`: `BOiPc1FSYfHfYjCs3ES4q1ITqzEQlpXrRtKH0e3pjAq0DoQ3zWw-rIm97aDitkQl2DWXwOr7SutGbXM-zs_0dp8`
   - `VAPID_PRIVATE_KEY`: la clave privada que te pasé por chat (NUNCA la pegues acá en este archivo ni la subas al repo — este repo es público, y esa clave tiene que quedar solo como secret de Supabase).
   - `VAPID_CONTACT_EMAIL`: tu email (el que quieras que vaya como contacto del VAPID, es un requisito del estándar Web Push — nunca se muestra a nadie, solo lo usan los servidores push de Chrome/Firefox si necesitan contactarte por abuso).

   (`SUPABASE_URL` y `SUPABASE_ANON_KEY` ya los inyecta Supabase automáticamente, no hace falta cargarlos.)

## Opción B — Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref chrvjpjehfjyugbkxuki
supabase functions deploy send-recordatorios
supabase secrets set VAPID_PUBLIC_KEY=BOiPc1FSYfHfYjCs3ES4q1ITqzEQlpXrRtKH0e3pjAq0DoQ3zWw-rIm97aDitkQl2DWXwOr7SutGbXM-zs_0dp8
supabase secrets set VAPID_PRIVATE_KEY=<pegá acá la clave privada que te pasé por chat, no la subas al repo>
supabase secrets set VAPID_CONTACT_EMAIL=tu-email@ejemplo.com
```

## Paso final (para las dos opciones): programar el cron

En el **SQL Editor** de Supabase, corré (reemplazando `<ANON_KEY>` por tu
`NEXT_PUBLIC_SUPABASE_ANON_KEY` de `.env.local`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-recordatorios-diario',
  '0 11 * * *', -- 11:00 UTC = 8:00 de Argentina (no tiene horario de verano)
  $$
  select net.http_post(
    url := 'https://chrvjpjehfjyugbkxuki.supabase.co/functions/v1/send-recordatorios',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Para probarlo ya mismo sin esperar al cron, ejecutá esta consulta una vez
(mismo `select net.http_post(...)` de arriba, sin el `cron.schedule` que lo
envuelve) o llamá a la función a mano desde el Dashboard (`Edge Functions →
send-recordatorios → Invoke`).

## Cómo funciona una vez desplegada

1. En la app, andá a **Configuración → Notificaciones push → Activar
   notificaciones** (necesita sync con Supabase activado). Esto guarda la
   suscripción del navegador en la tabla `push_subscriptions` — repetilo en
   cada dispositivo donde quieras recibir avisos.
2. Todos los días a las 8hs de Argentina, el cron llama a esta función.
3. La función revisa los recordatorios activos: si a alguno le toca avisar
   hoy (fecha exacta, o dentro de los "días de antelación" que configuraste
   en cada recordatorio) y todavía no se le mandó el push para esa fecha, le
   manda una notificación a todos los dispositivos suscriptos.
4. Tocar la notificación abre la app en `/recordatorios`.
