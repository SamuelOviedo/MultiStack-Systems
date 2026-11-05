---
paths:
  - "supabase/**"
  - "src/integrations/supabase/**"
  - "src/lib/auth.ts"
  - "src/lib/projects.ts"
  - "src/lib/tickets.ts"
  - "src/lib/portal.ts"
  - "src/lib/contact.ts"
---

# Supabase, datos y Edge Functions

- Migraciones solo hacia adelante: archivo nuevo en `supabase/migrations/` con su prueba en `supabase/tests/database/`. Nunca edites una migración existente.
- Las migraciones y funciones nunca se aplican desde aquí: las despliega el propietario. Merge a `main` no despliega nada.
- Toda tabla nueva: RLS activo, privilegios mínimos y una prueba pgTAP por rol.
- Edge Functions: lógica en un `handler.ts` inyectable con pruebas en Vitest; `index.ts` solo conecta dependencias.
- Fallo cerrado ante configuración faltante (clave, sal, secreto); los detalles van al log, nunca a la respuesta.
- Los logs no contienen correos, IP, nombres, mensajes de visitantes ni secretos.
- Las claves se leen por nombre (por ejemplo `SUPABASE_SECRET_KEYS.edge_functions`); nunca hay respaldo a otra clave.
- `src/integrations/supabase/types.ts` se regenera, no se edita.
