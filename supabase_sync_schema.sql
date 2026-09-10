-- ============================================================================
--  Bóveda Financiera — esquema de sincronización para Supabase (PostgreSQL)
-- ============================================================================
--  Corré este script una sola vez en:  Supabase → SQL Editor → New query.
--
--  Modelo de UN SOLO USUARIO: el `id` es el mismo id autoincremental que genera
--  Dexie en el navegador y se usa como PRIMARY KEY para que `upsert` funcione
--  (inserta si no existe, actualiza si ya está).
--
--  `last_updated` (texto ISO 8601) viaja en cada fila para resolver conflictos
--  por fecha en el futuro (eventual consistency).
--
--  Los tipos de fecha se guardan como TEXT porque la app los maneja como
--  strings ISO (new Date().toISOString()).
-- ============================================================================

create table if not exists public.cuentas (
  id           bigint primary key,
  nombre       text,
  tipo         text,
  moneda       text,
  saldo        double precision default 0,
  last_updated text
);

create table if not exists public.transacciones (
  id           bigint primary key,
  cuenta_id    bigint,
  tipo         text,
  monto        double precision default 0,
  moneda       text,
  categoria    text,
  descripcion  text,
  fecha        text,
  last_updated text
);

create table if not exists public.tarjetas (
  id              bigint primary key,
  nombre          text,
  dia_cierre      integer,
  dia_vencimiento integer,
  limite          double precision default 0,
  moneda          text,
  last_updated    text
);

create table if not exists public.deudas_tarjetas (
  id           bigint primary key,
  tarjeta_id   bigint,
  periodo      text,
  monto_total  double precision default 0,
  monto_pagado double precision default 0,
  estado       text,
  last_updated text
);

create table if not exists public.inversiones (
  id                bigint primary key,
  nombre            text,
  tipo              text,
  capital_inicial   double precision default 0,
  moneda            text,
  estado            text,
  cotizacion_compra double precision,
  costo_ars         double precision,
  fecha             text,
  last_updated      text
);

create table if not exists public.prestamos (
  id                bigint primary key,
  persona           text,
  tipo              text,
  monto             double precision default 0,
  moneda            text,
  estado            text,
  fecha_prestamo    text,
  cotizacion_origen double precision,
  cotizacion_cierre double precision,
  fecha_devolucion  text,
  last_updated      text
);

-- ============================================================================
--  SEGURIDAD (RLS)
-- ----------------------------------------------------------------------------
--  Por defecto las tablas nuevas NO tienen Row Level Security, así que la
--  `anon key` ya puede leer/escribir y el sync funciona sin más.
--
--  ⚠️  Con la anon key, cualquiera que tenga la URL del proyecto puede leer y
--  escribir estas tablas. Es aceptable para uso personal / proyecto descartable.
--  Para algo más serio, agregá Auth de Supabase y una columna user_id.
--
--  Si el panel te obliga a activar RLS, descomentá este bloque para permitir
--  todo con la anon key:
-- ----------------------------------------------------------------------------
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['cuentas','transacciones','tarjetas',
--                            'deudas_tarjetas','inversiones','prestamos']
--   loop
--     execute format('alter table public.%I enable row level security;', t);
--     execute format($p$
--       create policy "boveda_anon_all" on public.%I
--       for all to anon using (true) with check (true);
--     $p$, t);
--   end loop;
-- end $$;
