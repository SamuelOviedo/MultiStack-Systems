# Testing Strategy — MultiStack Systems

> Estrategia de tests actual. El setup ya está funcional — esta guía explica qué hay, cómo extenderlo, y qué no vale la pena testear.

---

## Estado actual

| Herramienta | Config | Tests existentes |
|---|---|---|
| Vitest 3 + Testing Library | `vitest.config.ts` | 12 tests — siteUrl, ProtectedRoute |
| Playwright 1.58 | `playwright.config.ts` | 6 tests — login page, redirects, landing |

```bash
npm run test          # Vitest (unitarios + componentes)
npm run test:watch    # Vitest en modo watch
npm run test:e2e      # Playwright E2E (necesita dev server)
```

Para Playwright la primera vez:
```bash
npx playwright install chromium
```

---

## Arquitectura de tests

```
src/test/
  setup.ts                   — jest-dom matchers + matchMedia mock
  example.test.ts            — test de smoke (verificar que Vitest funciona)
  siteUrl.test.ts            — tests de helpers puros en src/lib/siteUrl.ts
  ProtectedRoute.test.tsx    — tests de lógica de redirect y acceso

e2e/
  login.spec.ts              — tests E2E: login page, redirects protegidos, landing
```

---

## Setup de Vitest

**`vitest.config.ts`** — configurado con:
- `environment: "jsdom"` — DOM disponible en tests
- `globals: true` — `describe`, `it`, `expect` globales (no necesitan import)
- `setupFiles: ["./src/test/setup.ts"]` — corre antes de cada archivo
- `include: ["src/**/*.{test,spec}.{ts,tsx}"]` — pickup automático

**`src/test/setup.ts`** — incluye:
- `@testing-library/jest-dom` — matchers como `toBeInTheDocument`, `toBeVisible`
- Mock de `window.matchMedia` — requerido por componentes con media queries

**Path aliases** — `@/` funciona igual que en la app (configurado en `vitest.config.ts`).

---

## Cómo mockear `useAuth`

El patrón establecido en `ProtectedRoute.test.tsx`:

```tsx
import { vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from "@/hooks/useAuth"
const mockUseAuth = vi.mocked(useAuth)

// En cada test:
mockUseAuth.mockReturnValue({
  session: null,
  user: null,
  userType: null,
  loading: false,
  signOut: vi.fn(),
})
```

El mock se aplica antes de que el componente sea importado (vi.mock es hoisted por Vitest).

---

## Cómo testear componentes con routing

Usar `MemoryRouter` con rutas stub para capturar los redirects:

```tsx
function renderWithRoutes() {
  return render(
    <MemoryRouter initialEntries={["/ruta-a-testear"]}>
      <Routes>
        <Route path="/ruta-a-testear" element={<MiComponente />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/solicitudes" element={<div>Solicitudes</div>} />
      </Routes>
    </MemoryRouter>
  )
}
```

Cuando `<Navigate to="/login" replace />` se ejecuta, React Router actualiza el estado del MemoryRouter y renderiza la ruta `/login`, mostrando `"Login Page"`. Esto permite verificar redirects sin necesitar una URL real.

---

## Cómo testear funciones de lib/

Las funciones en `src/lib/` llaman a Supabase. Para testearlas:

```ts
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "1" }, error: null }),
    })),
  },
}))
```

Testear solo el comportamiento del wrapper — no que Supabase funcione (eso es responsabilidad del E2E o de tests de integración con DB real).

---

## Setup de Playwright

**`playwright.config.ts`** — configurado con:
- `testDir: "./e2e"` — tests en la carpeta `e2e/`
- `baseURL: "http://localhost:8080"` — misma URL del dev server
- `webServer` — lanza `npm run dev` automáticamente si no está corriendo
- Solo `chromium` por defecto — agregar más browsers si es necesario

Los tests de Playwright prueban la app real corriendo en dev. No mockean nada del frontend.

---

## Qué testear y qué no

### Vale la pena testear

| Qué | Cómo | Por qué |
|---|---|---|
| Helpers puros (`siteUrl.ts`, `utils.ts`) | Vitest sin mocks | Riesgo real de regresión silenciosa |
| Lógica de acceso (`ProtectedRoute`) | Vitest + mock useAuth | Alta criticidad, muchos paths |
| Funciones de lib/ con lógica condicional | Vitest + mock supabase | Lógica de negocio, no queries |
| Páginas críticas (login, dashboard) | Playwright | Verifica integración real |
| Redirects de auth | Playwright | Verifica flujo completo sin mocks |

### No vale la pena testear

| Qué | Por qué no |
|---|---|
| Componentes shadcn (`src/components/ui/`) | Auto-generados, no tienen lógica propia |
| Queries SQL en Supabase | Se testean con la DB real, no en unit tests |
| Estilos Tailwind | Tests de snapshot de clases son frágiles y no aportan |
| Tipos de TypeScript | El build ya lo verifica |
| Lógica trivial (getters, mappers simples) | Costo mayor que beneficio |

---

## Criterio para agregar un test nuevo

Agregar un test cuando:
1. Una función tiene lógica condicional que puede tomar caminos distintos
2. Un bug fue encontrado en producción — el test previene regresión
3. Una función es crítica y modificarla sin test es arriesgado

No agregar un test porque "debería haber coverage". Los tests frágiles que hay que actualizar en cada cambio de UI son peor que no tenerlos.

---

## Convenciones

- Archivos de test Vitest: `src/test/*.test.{ts,tsx}`
- Archivos E2E Playwright: `e2e/*.spec.ts`
- No usar `describe.only` o `test.only` en código que se commitea
- Mocks específicos por describe block con `beforeEach` reset
- Los test IDs (si se necesitan) van como `data-testid` en el componente — preferir queries por role/label/text antes de usar testid
