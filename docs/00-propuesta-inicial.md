# Propuesta inicial — SaaS de inventario (respuesta a la sección 15 del plan maestro)

> Estado: **borrador para aprobación**. No se ha escrito código todavía.
> Todo lo marcado como *Recomendación* es una propuesta, no un requisito confirmado.

---

## 1. Resumen del plan en mis palabras

Vamos a construir una app web (instalable como PWA) para que pequeños negocios colombianos que hoy usan cuaderno o Excel lleven su inventario y sus ventas sin capacitación. El núcleo es aburrido a propósito: **productos, movimientos de stock y ventas, siempre consistentes, trazables y aislados por negocio**. Sobre ese núcleo, y solo cuando esté validado, se agregan importación de Excel, suscripción trimestral y, al final, voz, foto y WhatsApp como atajos que *proponen* datos y nunca escriben sin confirmación.

El éxito del MVP no es "tener IA", es: un dueño crea su negocio, carga productos, registra entradas y ventas, ve su margen bruto estimado y puede exportar sus datos, sin que nunca se mezcle información entre negocios y con un costo por cliente conocido.

---

## 2. Supuestos y decisiones pendientes

### Supuestos que tomo para avanzar (corrígeme si alguno es falso)

| # | Supuesto |
|---|----------|
| S1 | Un usuario pertenece normalmente a **un** negocio en el MVP, pero el modelo admite varios. |
| S2 | Moneda única por negocio: **COP**. Zona horaria por defecto `America/Bogota`. |
| S3 | Los precios de venta se registran **tal como el negocio los cobra** (IVA incluido si aplica). El MVP no calcula impuestos; los reportes lo aclaran. |
| S4 | Las cantidades admiten decimales (hasta 3) para productos a granel (kg, litros, metros). |
| S5 | **No se permite stock negativo.** Una venta sin existencias se bloquea; el usuario debe registrar primero una entrada o un ajuste. |
| S6 | Los productos no se borran: se desactivan (conservan historial). |
| S7 | Sin variantes (talla/color) en el MVP. Ver decisión D2. |

### Decisiones abiertas (sección 14) con mi recomendación

| # | Decisión | Impacto | Recomendación |
|---|----------|---------|---------------|
| D1 | Nombre y marca | Dominio, branding | Usar un nombre clave interno ("inventario") hasta la Fase 8. No bloquea. |
| D2 | Segmento inicial | **Alto en el modelo de datos**: ropa exige variantes (talla/color); ferretería y graneles exigen unidades fraccionadas y conversiones. | Empezar con **tiendas de barrio / misceláneas / belleza** (catálogo simple, sin variantes). Decidir con las entrevistas de la Fase 0 antes de la Fase 2. |
| D3 | Precio final y planes | Ingresos, cuotas | Mantener $89.900/trimestre como hipótesis; un solo plan en el piloto. |
| D4 | Prueba de 7 días | Activación | Sí, **sin tarjeta**. Se crea automáticamente al crear el negocio. |
| D5 | Proveedor de pagos y renovación | Fase 5 | Comparar Wompi, Mercado Pago, ePayco y PayU (verificar si admiten cobro trimestral y webhooks). *Recomendación inicial:* **renovación manual con link de pago** + avisos; es más simple y evita guardar medios de pago. Automática después si los clientes la piden. |
| D6 | Proveedor de IA (voz/foto) | Fase 6, costos | Decidir en la Fase 6 con pruebas reales. Transcripción: comparar la del navegador (soporte irregular según dispositivo) con un servicio externo. Interpretación de texto y lectura de fotos: un modelo con salida estructurada y visión. No elijo nada todavía. |
| D7 | WhatsApp | Fase 7, costos | Verificar en ese momento WhatsApp Cloud API (Meta) directo vs. un BSP. Empezar solo con alertas de stock bajo. |
| D8 | Modo offline real | Complejidad alta | **No** en el MVP. La PWA solo guarda en caché la interfaz; las operaciones requieren conexión. |
| D9 | Método de costo | Margen, reportes | **Costo promedio ponderado.** Es fácil de explicar, se calcula en cada entrada y es suficiente para un margen estimado. FIFO queda descartado para el MVP. |
| D10 | Retención / exportación | Privacidad, costos | Exportación CSV siempre disponible (incluso vencido). Nunca borrar por falta de pago sin aviso previo. Imágenes de IA: borrar tras procesar (≤24 h). Archivos de importación: 30 días. Eliminación de cuenta a solicitud. |
| D11 | Límites de uso por plan | Rentabilidad | Definirlos en la Fase 6 con costos medidos. La tabla `ai_usage` y la verificación de cuota existen desde antes. |
| D12 | Soporte, reembolsos, gracia | Comercial | **7 días de gracia**, después modo **solo lectura + exportación**. Política de reembolsos: a definir con asesoría. |

Decisiones adicionales que detecté y que el plan no menciona:

- **D13 — Librería para leer Excel.** Opciones: SheetJS (la versión publicada en npm está desactualizada; la mantenida se instala desde el CDN de SheetJS) o `exceljs` (solo .xlsx). *Recomendación:* SheetJS desde su fuente oficial, con el archivo leído **en el navegador** para la vista previa y las filas **revalidadas en el servidor**. Así el servidor nunca abre archivos Office no confiables.
- **D14 — Escaneo de código de barras con la cámara.** Es barato (sin IA) y muy útil para registrar ventas. Lo propongo como mejora en la Fase 4, no como parte del MVP mínimo.

---

## 3. Arquitectura recomendada y justificación

**Monolito modular = una SPA en React + un proyecto Supabase.** No hay servidor propio en las Fases 1 a 4.

```
Navegador (React + TS + Vite, PWA)
   │  supabase-js (HTTPS, JWT del usuario)
   ▼
Supabase
   ├── Auth ............................ registro / sesión
   ├── PostgREST (lecturas) ............ protegidas por RLS
   ├── Funciones SQL (RPC) ............. TODAS las escrituras de negocio
   │      └─ validan membresía + suscripción + reglas, en una transacción
   ├── Storage privado ................. importaciones, imágenes temporales
   └── Edge Functions (Fase 5+) ........ webhooks de pago, IA, WhatsApp
                                          (los secretos solo viven aquí)
```

**Regla central: "se lee con RLS, se escribe con RPC".**

- El frontend puede **leer** tablas directamente; RLS filtra por membresía.
- El rol `authenticated` **no tiene permisos de INSERT, UPDATE ni DELETE** sobre las tablas de negocio. Toda escritura pasa por funciones de Postgres (`create_product`, `record_stock_movement`, `create_sale`, `cancel_sale`, `import_products`…). Cada una:
  1. verifica que `auth.uid()` es miembro activo del negocio, con el rol adecuado;
  2. verifica que la suscripción permite escribir;
  3. valida datos;
  4. hace todo en **una sola transacción** (stock + movimiento + venta, o nada).

**Por qué:** la consistencia del stock y el aislamiento se garantizan en la base de datos, no en la interfaz ni en un servidor intermedio que tendríamos que operar. La comprobación de suscripción queda en un solo lugar. Y Postgres es portable si algún día dejamos Supabase.

**Stack de frontend (mínimo):** React 19, TypeScript estricto, Vite, React Router, TanStack Query (caché y estados de carga), Zod (esquemas de formularios, compartidos con las Edge Functions más adelante), React Hook Form y Tailwind CSS. Pruebas con Vitest y Testing Library; E2E con Playwright desde la Fase 2.

**Pruebas de base de datos:** pgTAP mediante `supabase test db`. Aquí van las pruebas de aislamiento y de stock.

---

## 4. Estructura de carpetas propuesta

```
inventario/
├── docs/
│   ├── 00-propuesta-inicial.md
│   └── decisiones/              # ADRs cortos: 0001-costo-promedio.md, ...
├── supabase/
│   ├── config.toml
│   ├── migrations/              # SQL versionado: 20261010000000_base.sql, ...
│   ├── tests/                   # pgTAP: aislamiento, stock, ventas
│   ├── functions/               # Edge Functions (Fase 5+)
│   └── seed.sql                 # datos de desarrollo (2 negocios de prueba)
├── src/
│   ├── app/                     # router, providers, layout, rutas protegidas
│   ├── features/
│   │   ├── auth/
│   │   ├── business/            # onboarding, negocio activo
│   │   ├── products/
│   │   ├── inventory/           # movimientos
│   │   ├── sales/
│   │   ├── imports/
│   │   ├── dashboard/
│   │   └── subscription/
│   │       # cada feature: api.ts · schemas.ts · hooks.ts · components/ · *.test.ts
│   ├── components/ui/           # botones, inputs, diálogos
│   ├── lib/                     # supabaseClient, money.ts, quantity.ts, format.ts
│   └── types/database.ts        # generado: supabase gen types
├── e2e/                         # Playwright
├── .github/workflows/ci.yml     # lint + typecheck + test + test db
├── .env.example                 # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
└── package.json
```

---

## 5. Primer diseño de esquema (migración base)

Convenciones:

- Todas las tablas de negocio llevan `business_id`.
- **Claves foráneas compuestas `(business_id, x_id)`.** Así la base de datos *impide físicamente* que una venta use un producto de otro negocio, aunque una función tenga un error.
- Dinero en `numeric(14,2)`, costo promedio en `numeric(14,4)`, cantidades en `numeric(14,3)`. Nunca `float`.
- En el frontend, el dinero se maneja como entero en pesos o como string decimal; nunca se suma con `number` sin control.

```sql
-- Tipos
create type member_role        as enum ('owner', 'admin', 'staff');
create type movement_type      as enum ('initial', 'purchase', 'sale', 'sale_reversal',
                                        'adjustment', 'return');
create type subscription_status as enum ('trialing', 'active', 'past_due',
                                         'expired', 'cancelled');

create table businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 120),
  business_type text,
  currency      char(3) not null default 'COP',
  timezone      text not null default 'America/Bogota',
  status        text not null default 'active',   -- active | suspended
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table business_members (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null,
  status      text not null default 'active',     -- active | revoked
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on business_members (user_id);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  unique (business_id, id)
);
create unique index categories_name_uq on categories (business_id, lower(name));

create table products (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  name                text not null check (length(btrim(name)) between 1 and 200),
  sku                 text,
  barcode             text,
  category_id         uuid,
  unit                text not null default 'unidad',
  sale_price          numeric(14,2) not null default 0 check (sale_price >= 0),
  low_stock_threshold numeric(14,3) not null default 0 check (low_stock_threshold >= 0),
  is_active           boolean not null default true,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, category_id)
    references categories (business_id, id) on delete set null (category_id)
);
create unique index products_sku_uq     on products (business_id, lower(sku))  where sku is not null;
create unique index products_barcode_uq on products (business_id, barcode)     where barcode is not null;
create index        products_name_idx   on products (business_id, lower(name));

-- Saldo materializado: SOLO lo modifican las funciones de stock, en la misma
-- transacción que inserta el movimiento. Se puede reconciliar con el historial.
create table inventory_balances (
  product_id   uuid primary key,
  business_id  uuid not null,
  quantity     numeric(14,3) not null default 0 check (quantity >= 0),
  average_cost numeric(14,4) not null default 0 check (average_cost >= 0),
  updated_at   timestamptz not null default now(),
  foreign key (business_id, product_id) references products (business_id, id)
);

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  product_id      uuid not null,
  movement_type   movement_type not null,
  quantity_delta  numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost       numeric(14,4) check (unit_cost >= 0),
  reference_type  text,                -- 'sale' | 'import' | null
  reference_id    uuid,
  reason          text,
  idempotency_key uuid,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  foreign key (business_id, product_id) references products (business_id, id)
);
create index on stock_movements (business_id, product_id, created_at desc);
create unique index stock_movements_idem_uq
  on stock_movements (business_id, idempotency_key) where idempotency_key is not null;

create table sales (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id),
  status          text not null default 'completed',   -- completed | cancelled
  subtotal        numeric(14,2) not null check (subtotal >= 0),
  discount_total  numeric(14,2) not null default 0 check (discount_total >= 0),
  total           numeric(14,2) not null check (total >= 0),
  currency        char(3) not null,
  idempotency_key uuid not null,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid references auth.users(id),
  unique (business_id, id),
  unique (business_id, idempotency_key)
);
create index on sales (business_id, created_at desc);

create table sale_items (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null,
  sale_id                  uuid not null,
  product_id               uuid not null,
  quantity                 numeric(14,3) not null check (quantity > 0),
  unit_sale_price_snapshot numeric(14,2) not null check (unit_sale_price_snapshot >= 0),
  unit_cost_snapshot       numeric(14,4) not null check (unit_cost_snapshot >= 0),
  line_total               numeric(14,2) not null,
  foreign key (business_id, sale_id)    references sales    (business_id, id),
  foreign key (business_id, product_id) references products (business_id, id)
);

create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null unique references businesses(id),
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  plan_code                text not null default 'pilot',
  status                   subscription_status not null default 'trialing',
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  grace_days               int not null default 7,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
```

Las tablas `imports`, `ai_usage`, `notifications` y `webhook_events` siguen el plan maestro y se crean en la migración de su fase, con el mismo patrón de `business_id` y claves compuestas. `webhook_events` lleva `unique (provider, provider_event_id)`.

### Funciones de escritura (Fases 1–4)

| Función | Qué hace en una sola transacción |
|---|---|
| `create_business(name, type)` | Crea el negocio, la membresía `owner` y la suscripción `trialing` (7 días). |
| `create_product(...)` / `update_product(...)` | Valida, inserta o actualiza el producto, crea el saldo en 0 y, si hay stock inicial, un movimiento `initial`. |
| `record_stock_movement(business, product, type, qty, unit_cost, reason, idem_key)` | Bloquea el saldo (`FOR UPDATE`), revisa la clave de idempotencia, recalcula el costo promedio en las entradas, rechaza dejar el stock negativo e inserta el movimiento. |
| `create_sale(business, items[], idem_key)` | Bloquea los saldos **en orden por `product_id`** (evita deadlocks), valida las existencias, guarda las fotos (*snapshots*) de precio y costo, descuenta stock y crea los movimientos `sale`. |
| `cancel_sale(business, sale_id, reason)` | Marca la venta como `cancelled` y crea movimientos `sale_reversal`. Nunca borra. |

Todas son `SECURITY DEFINER` con `set search_path = ''` y llaman primero a `private.assert_can_write(business_id)`.

**Reconciliación:** la vista `stock_reconciliation` compara `inventory_balances.quantity` con `sum(stock_movements.quantity_delta)`. Una prueba automática exige cero diferencias.

---

## 6. Estrategia de aislamiento multiempresa

Hay cuatro capas, y cada una funciona aunque otra falle:

1. **Base de datos (estructural).** Las FK compuestas `(business_id, id)` hacen imposible relacionar filas de negocios distintos.
2. **RLS en todas las tablas `public`.** Se activa `enable row level security` en cada tabla. Las políticas de lectura usan un helper en un esquema no expuesto:
   ```sql
   create function private.is_member(p_business uuid) returns boolean
   language sql stable security definer set search_path = '' as $$
     select exists (select 1 from public.business_members m
                    where m.business_id = p_business
                      and m.user_id = (select auth.uid())
                      and m.status = 'active');
   $$;
   -- ejemplo
   create policy products_select on products for select to authenticated
     using ((select private.is_member(business_id)));
   ```
   Sin políticas de INSERT, UPDATE ni DELETE, y con `revoke` explícito de esos permisos para `anon` y `authenticated`.
3. **Funciones RPC.** El `business_id` que envía el frontend es solo una *pista*: cada función verifica de nuevo la membresía y el rol con `auth.uid()`, que viene del JWT y el cliente no puede falsificar.
4. **Storage.** Las rutas son `{business_id}/imports/...` y las políticas de Storage verifican `is_member` sobre el primer segmento. Las descargas usan URLs firmadas de corta duración.

**Otros controles:**

- La `service_role key` nunca llega al frontend ni a `.env` con prefijo `VITE_`.
- Una prueba de CI busca claves sospechosas en el build.

**Pruebas obligatorias (pgTAP)**, con dos negocios A y B y dos usuarios:

- A no puede listar, leer ni contar productos, ventas ni movimientos de B.
- A no puede llamar a ninguna RPC con el `business_id` de B, ni con su propio `business_id` y un `product_id` de B.
- A no puede insertar, actualizar ni borrar directamente en ninguna tabla, ni siquiera en las de su propio negocio.
- Un usuario anónimo no ve nada.
- Un miembro con estado `revoked` pierde el acceso.

---

## 7. Plan de trabajo por fases

La Fase 0 (entrevistas) es tuya y puede correr en paralelo con la Fase 1, porque esta no depende del segmento.

### Fase 1 — Fundaciones (lo primero que haría)

| # | Tarea | Verificación |
|---|-------|--------------|
| 1.1 | Inicializar Git, Vite + React + TS estricto, ESLint, Prettier y Vitest | `npm run lint`, `typecheck` y `test` en verde |
| 1.2 | Tailwind, layout móvil primero y router con rutas públicas y protegidas | Se ve en el teléfono y en el escritorio |
| 1.3 | Supabase local (CLI vía `npx supabase`), `.env.example` y documentación de configuración | `supabase start` levanta el entorno |
| 1.4 | Migración base: negocios, perfiles, membresías y suscripciones, más los helpers `private.*` y RLS | `supabase db reset` sin errores |
| 1.5 | Registro, inicio de sesión, cierre de sesión y recuperación de contraseña (correo + contraseña) | Prueba manual + test de componentes |
| 1.6 | Onboarding: `create_business` y negocio activo en el contexto | Un usuario nuevo termina con su negocio y su prueba de 7 días |
| 1.7 | Pruebas pgTAP de aislamiento sobre las tablas de esta fase | `supabase test db` en verde |
| 1.8 | CI en GitHub Actions: lint, typecheck, test y test db | Pipeline en verde |

**Criterio de salida:** ninguna prueba logra leer ni alterar datos de otro negocio, y la CI corre esas pruebas en cada cambio.

### Fases siguientes (resumen; cada una se detallará antes de empezarla)

| Fase | Contenido | Criterio de aceptación |
|------|-----------|------------------------|
| 2 — Inventario | Productos, categorías, saldos, movimientos, búsqueda, stock bajo, dashboard básico, exportación CSV | La reconciliación da 0 diferencias. Las operaciones repetidas con la misma clave no duplican. Las pruebas de aislamiento se extienden a las tablas nuevas. |
| 3 — Importación | Plantilla, lectura en el navegador, mapeo de columnas, vista previa, errores por fila, `import_products` idempotente, modos "crear" y "actualizar" separados | Reintentar una importación no duplica. Un archivo malo no deja cambios parciales. |
| 4 — Ventas y reportes | `create_sale` y `cancel_sale`, snapshots, ventas del día y del periodo, más vendidos, margen bruto estimado | Una prueba de concurrencia (N ventas simultáneas sobre el último stock) nunca deja el stock negativo. Los reportes cuadran con `sale_items`. |
| 5 — Suscripción | Proveedor (D5), Edge Function de webhook con firma verificada, `webhook_events`, gracia y modo solo lectura | Un evento repetido no cambia el estado dos veces. Una redirección del navegador no activa la suscripción. |
| 6 — Voz y foto | Adaptador de IA en una Edge Function, salida validada con Zod, vista previa editable, `ai_usage` y cuotas en el servidor | Sin confirmación no hay escritura. Se registra el costo por operación. |
| 7 — WhatsApp | Alertas de stock bajo, después consultas de solo lectura | El destinatario es el correcto y nunca se filtran datos de otro negocio. |
| 8 — Piloto | 5–10 negocios, métricas, prueba de restauración de backup | Se cumple la definición de éxito del MVP (sección 16 del plan). |

---

## 8. Riesgos técnicos y de costos

| Riesgo | Mitigación |
|--------|------------|
| Una función `SECURITY DEFINER` mal escrita puede saltarse RLS: es **el mayor riesgo de fuga** | Una plantilla única de función que empieza con `assert_can_write`, pruebas pgTAP por cada función y `search_path` vacío. |
| Las políticas RLS lentas con muchos datos | Usar `(select auth.uid())` (se evalúa una vez), índices por `business_id` y revisar con `EXPLAIN` en la Fase 8. |
| Deadlocks en ventas con varios productos | Bloquear siempre en orden por `product_id`. Ya hay una prueba de concurrencia en la Fase 4. |
| Un saldo materializado desincronizado | Solo las funciones lo escriben, y la vista y la prueba de reconciliación lo vigilan. |
| Archivos Excel maliciosos o enormes | Se leen en el navegador, con límite de tamaño y de filas. El servidor solo recibe JSON validado. |
| Supabase: el plan gratuito pausa los proyectos inactivos y tiene límites | Desarrollar en local. Para el piloto, presupuestar el plan de pago (el plan maestro estima ~$100.000 COP/mes; **verificar el precio vigente**). |
| Dependencia de Supabase | Es Postgres estándar y las migraciones SQL son portables. Auth y Storage serían lo único que habría que migrar. |
| Costos de IA y WhatsApp descontrolados | Cuotas en el servidor desde el primer día de la Fase 6, y alertas de presupuesto en los proveedores. |
| Comisión de pago mayor a la supuesta | El cálculo del plan (neto ~$85.428/trimestre) se rehace con la tarifa real en la Fase 5. |

---

## 9. Preguntas bloqueantes

Solo estas impiden empezar la Fase 1:

1. **Docker.** El entorno local de Supabase (y por lo tanto las pruebas de aislamiento) necesita Docker Desktop, que no está instalado. Opciones:
   - **(a) Recomendada:** instalar Docker Desktop. Todo corre en local y es gratis.
   - **(b)** Usar un proyecto Supabase en la nube solo para desarrollo. Funciona, pero las pruebas de base de datos son más lentas y algo más frágiles de automatizar.
2. **Git.** No está instalado. Lo necesito para versionar y para la CI. ¿Lo instalas (Git for Windows), y tienes o quieres una cuenta de GitHub para la CI?
3. **Ubicación.** ¿Creo el proyecto aquí (`Desktop\Nueva carpeta`) o prefieres otra carpeta y nombre?

Todo lo demás (segmento, pagos, IA, WhatsApp) **no bloquea la Fase 1**. Lo resolvemos antes de la fase que lo necesite.
