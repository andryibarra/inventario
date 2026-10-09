# Inventario

App web de inventario para pequeños negocios en Colombia. React + TypeScript +
Vite en el frontend; Supabase (PostgreSQL, Auth, RLS) como backend.

- Plan y decisiones: [docs/00-propuesta-inicial.md](docs/00-propuesta-inicial.md)
- Registro de decisiones técnicas: [docs/decisiones/](docs/decisiones/)

## Requisitos

- Node 24 (ver `.nvmrc`)
- Docker Desktop en ejecución (para Supabase local)
- Git

## Puesta en marcha

```bash
npm install
npm run db:start          # levanta Supabase local (la primera vez descarga imágenes)
npx supabase status       # muestra URL y claves locales
cp .env.example .env.local   # completa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev               # http://localhost:5173
```

Los correos (confirmación de cuenta, recuperar contraseña) no salen a internet
en local: se ven en Mailpit, en la URL que muestra `npx supabase status`
(por defecto http://127.0.0.1:54324).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Pruebas de frontend (Vitest) |
| `npm run build` | Build de producción |
| `npm run db:start` / `db:stop` | Encender / apagar Supabase local |
| `npm run db:reset` | Recrear la base local desde las migraciones + `seed.sql` |
| `npm run db:test` | Pruebas pgTAP (aislamiento entre negocios, estructura) |
| `npm run db:types` | Regenerar `src/types/database.ts` desde la base local |

## Reglas del proyecto

1. **Se lee con RLS, se escribe con RPC** ([ADR 0001](docs/decisiones/0001-escrituras-por-rpc.md)).
2. Cambios de base de datos solo con migraciones nuevas en `supabase/migrations/`
   (`npx supabase migration new <nombre>`). Nunca editar una migración ya aplicada.
3. Toda función nueva que escriba datos lleva pruebas de aislamiento en `supabase/tests/`.
4. Solo claves públicas con prefijo `VITE_`. La clave secreta / service_role nunca va al frontend.
