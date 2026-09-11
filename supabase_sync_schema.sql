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
  reintegrable boolean default false,
  reintegrado  boolean default false,
  last_updated text
);

-- Alta de columnas nuevas si la tabla ya existía de una versión anterior.
alter table public.transacciones add column if not exists reintegrable boolean default false;
alter table public.transacciones add column if not exists reintegrado  boolean default false;

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

-- ----- Módulos PRO -----

create table if not exists public.presupuestos (
  id           bigint primary key,
  categoria    text,
  monto_limite double precision default 0,
  moneda       text,
  mes          text,
  last_updated text
);

create table if not exists public.suscripciones (
  id                    bigint primary key,
  descripcion           text,
  monto                 double precision default 0,
  moneda                text,
  categoria             text,
  cuenta_id             bigint,
  dia_cobro             integer,
  activa                boolean default true,
  ultimo_cobro_periodo  text,
  last_updated          text
);

create table if not exists public.metas_ahorro (
  id             bigint primary key,
  nombre         text,
  monto_objetivo double precision default 0,
  moneda         text,
  color_hex      text,
  last_updated   text
);

create table if not exists public.configuracion (
  id           bigint primary key,
  clave        text unique,
  valor        text,
  last_updated text
);

create table if not exists public.compras_tarjeta (
  id             bigint primary key,
  tarjeta_id     bigint,
  descripcion    text,
  monto_total    double precision default 0,
  cuotas_totales integer,
  periodo_inicio text,
  moneda         text,
  fecha          text,
  last_updated   text
);

-- ============================================================================
--  SEGURIDAD (RLS) — REQUERIDO para que el sync pueda escribir
-- ----------------------------------------------------------------------------
--  ⚠️  Estas políticas permiten leer y ESCRIBIR con la `anon key`. Cualquiera
--  que tenga la URL del proyecto puede modificar estas tablas. Es aceptable
--  para uso personal (sincronizar tu compu y tu celu). Para multiusuario real,
--  agregá Supabase Auth + una columna `user_id` y filtrá por `auth.uid()`.
--
--  Este bloque es idempotente: podés correrlo las veces que quieras.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  roles constant text := 'anon, authenticated';
begin
  foreach t in array array['cuentas','transacciones','tarjetas',
                           'deudas_tarjetas','inversiones','prestamos',
                           'presupuestos','suscripciones','metas_ahorro',
                           'configuracion','compras_tarjeta']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "boveda_rw" on public.%I;', t);
    execute format(
      'create policy "boveda_rw" on public.%I for all to %s using (true) with check (true);',
      t, roles
    );
  end loop;
end $$;
