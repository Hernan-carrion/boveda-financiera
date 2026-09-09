# 🏦 Bóveda Financiera

PWA **100% local-first** para gestión de finanzas personales: cuentas multimoneda,
tarjetas, préstamos y carga rápida de gastos en lenguaje natural. No hay servidor
ni base de datos remota — **todos los datos viven en tu navegador** (IndexedDB via
Dexie) y nunca salen del dispositivo.

## 🔗 Demo en vivo

**https://hernan-carrion.github.io/boveda-financiera/**

Instalable como app (Add to Home Screen / Instalar) y funciona offline.

## Funcionalidades

- **Dashboard**: saldos globales por moneda (ARS / USD), saldo por cuenta y
  movimientos recientes con corrección de categoría en línea.
- **Carga rápida**: escribís algo como `5000 nafta ypf con mp` o
  `cobré 300000 sueldo` y un motor **determinista** (sin IA, sin red) extrae
  monto, cuenta, tipo y categoría; muestra vista previa antes de guardar.
- **Tarjetas**: alta de tarjetas (cierre/vencimiento/límite), registro de
  consumos por período y pago de resúmenes descontando de una cuenta.
- **Préstamos**: asentar dinero prestado o pedido y registrar devoluciones,
  ajustando saldos automáticamente.
- **Configuración**: exportar/importar toda la base como JSON, ajustar saldos y
  crear cuentas.

## Stack

- Next.js 16 (App Router) con **export estático** (`output: 'export'`)
- Dexie.js sobre IndexedDB (`lib/db.ts`)
- Tailwind CSS 4, lucide-react, date-fns
- Service Worker + Web App Manifest para PWA instalable

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # genera el sitio estático en out/
```

## Deploy

Cada push a `main` dispara [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
que hace `npm run build` y publica `out/` en GitHub Pages. El workflow define
`NEXT_PUBLIC_BASE_PATH` a partir de `actions/configure-pages` para que los assets
resuelvan bajo la subruta del repositorio.

## Privacidad

La app no envía datos a ningún lado. Para respaldar o migrar tu información usá
**Configuración → Exportar JSON**; al importar un backup se sobrescribe todo lo
que haya en ese navegador.
