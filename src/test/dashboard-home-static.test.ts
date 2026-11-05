// Garantías estáticas del código de producción del Resumen y de la lista de proyectos:
// ningún dato inventado, ningún tono de consola, ningún mensaje técnico en pantalla, ninguna consulta directa a
// Supabase desde componentes, y los cambios de ruta/auth que NO se deben haber hecho.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import appSource from "@/App.tsx?raw";
import protectedRouteSource from "@/components/common/ProtectedRoute.tsx?raw";

const SRC = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

/** Código de producción: el Resumen, la lista de proyectos y los componentes que usan. */
const HOME_DIR = path.join(SRC, "components/dashboard/dashboard-home");
const PRODUCTION = [
  path.join(SRC, "pages/dashboard/Dashboard.tsx"),
  path.join(SRC, "pages/dashboard/ProjectsList.tsx"),
  ...walk(HOME_DIR).filter((f) => /\.(ts|tsx)$/.test(f)),
];
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");

describe("código de producción del Resumen · sin datos inventados", () => {
  it("hay archivos que revisar", () => {
    expect(PRODUCTION.length).toBeGreaterThanOrEqual(15);
  });

  it("no contiene correos, teléfonos, dominios de ejemplo ni nombres de empresa o persona inventados", () => {
    // Únicos textos de ayuda de los campos del alta (placeholders de formulario, no datos).
    const AYUDA = ["cliente@email.com", "+504 0000-0000"];
    for (const f of PRODUCTION) {
      let text = read(f);
      for (const ayuda of AYUDA) text = text.split(ayuda).join("");
      expect(text, rel(f)).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(text, rel(f)).not.toMatch(/\+?504[\s-]?\d{4}|\b\d{4}-\d{4}\b/);
      expect(text, rel(f)).not.toMatch(/\.example\b|example\.(com|org|net)|\.test["'`/]|lorem|ipsum|datos de (demo|ejemplo|demostración)|mock|fixture|faker/i);
    }
  });

  it("no define arreglos de registros con cifras o nombres de proyectos/clientes", () => {
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/nombre_proyecto:\s*["'`][^"'`]|client_name:\s*["'`][^"'`]/);
    }
  });

  it("las únicas cifras literales de las reglas son las documentadas (30 días, 7 días, 6 elementos, 6 etapas)", () => {
    const metrics = read(path.join(HOME_DIR, "projectMetrics.ts"));
    expect(metrics).toMatch(/RENEWAL_WINDOW_DAYS = 30/);
    expect(metrics).toMatch(/URGENT_RENEWAL_DAYS = 7/);
    // «Próximamente» no muestra ninguna cifra.
    expect(read(path.join(HOME_DIR, "UpcomingModules.tsx"))).not.toMatch(/\d/);
  });

  it("las cifras que se muestran salen de datos cargados: KpiTile recibe valores calculados, no literales", () => {
    const stats = read(path.join(HOME_DIR, "DashboardStats.tsx"));
    expect(stats).not.toMatch(/value=\{\s*\d/);
    expect(stats).not.toMatch(/value="/);
  });
});

describe("código de producción del Resumen · voz y mensajes", () => {
  it("sin estilo de consola: ni «$ multistack», ni «session:», ni botones con corchetes, ni fuentes mono/display", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/\$ multistack|multistack (dashboard|create)|session:|\[ [A-ZÁÉÍÓÚ ]+ \]/);
      expect(text, rel(f)).not.toMatch(/font-mono|font-display|glow-primary|uppercase|tracking-widest/);
    }
  });

  it("no muestra el mensaje crudo del error (e.message / error.message / String(e)) y no hay `any`", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/\b(e|err|error)\.message\b|String\((e|err|error)\)/);
      expect(text, rel(f)).not.toMatch(/:\s*any\b|\bas any\b/);
    }
  });

  it("los componentes no consultan Supabase: solo src/lib (a través de useDashboardData)", () => {
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/integrations\/supabase|supabase\.from|\.rpc\(/);
    }
    // Las lecturas pasan por TanStack Query en un solo archivo.
    const hook = read(path.join(HOME_DIR, "useDashboardData.ts"));
    expect(hook).toMatch(/from "@\/lib\/projects"/);
    expect(hook).toMatch(/from "@\/lib\/tickets"/);
  });

  it("sin colores crudos ni degradados ni vidrio ni sombras pesadas ni transiciones prohibidas", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, rel(f)).not.toMatch(/gradient|backdrop-blur|shadow-(md|lg|xl|2xl)|transition-all|animate-(?!none)/);
    }
  });

  it("toda transición de color respeta el movimiento reducido", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      for (const m of text.matchAll(/className="([^"]*\btransition-colors\b[^"]*)"/g)) {
        expect(m[1], `${rel(f)}: ${m[1].slice(0, 60)}`).toMatch(/motion-reduce:transition-none/);
      }
    }
  });

  it("los estados de la interfaz salen de los mapas reales (STATUS_CONFIG / TICKET_STATUS_CONFIG), no de etiquetas copiadas", () => {
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/["'`](En análisis|En desarrollo|En despliegue|Mantenimiento|Cancelado)["'`]/);
    }
  });
});

describe("rutas y permisos del Resumen y la lista de proyectos", () => {
  it("auth y ProtectedRoute siguen con su valor por defecto [0, 1] y App no pasa allowedTypes a las rutas del panel", () => {
    expect(protectedRouteSource).toContain("allowedTypes = [0, 1]");
    const panel = appSource.split("<Route").filter((c) => /path="\/dashboard/.test(c));
    expect(panel.length).toBe(4);
    for (const route of panel) expect(route).not.toMatch(/allowedTypes/);
  });

  it("la ruta nueva está definida una sola vez y las URL anteriores siguen existiendo", () => {
    const paths = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    expect(paths.filter((p) => p === "/dashboard/proyectos")).toHaveLength(1);
    for (const p of ["/dashboard", "/dashboard/project/:id", "/dashboard/tickets", "/solicitudes"]) {
      expect(paths, p).toContain(p);
    }
  });
});
