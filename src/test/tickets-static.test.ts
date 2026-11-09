// Garantías estáticas del código de producción del Soporte (lista de tickets, cajón y formulario de
// sub-tickets): ningún dato inventado, sin voz de consola, sin mensajes técnicos en pantalla, sin consultas a
// Supabase desde componentes, sin colores crudos, y los cambios de rutas y permisos que NO se deben haber hecho.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import appSource from "@/App.tsx?raw";
import protectedRouteSource from "@/components/common/ProtectedRoute.tsx?raw";

const SRC = path.resolve(__dirname, "..");
const TICKETS_DIR = path.join(SRC, "components/dashboard/tickets");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

const PRODUCTION = [
  path.join(SRC, "pages/dashboard/TicketsGlobal.tsx"),
  path.join(SRC, "components/dashboard/project-detail/SubTicketForm.tsx"),
  ...walk(TICKETS_DIR).filter((f) => /\.(ts|tsx)$/.test(f)),
];
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");

describe("código de producción del Soporte · sin datos inventados", () => {
  it("hay archivos que revisar", () => {
    expect(PRODUCTION.length).toBeGreaterThanOrEqual(9);
  });

  it("no contiene correos, teléfonos, dominios de ejemplo ni nombres de empresa o persona inventados", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(text, rel(f)).not.toMatch(/\+?504[\s-]?\d{4}|\b\d{4}-\d{4}\b/);
      expect(text, rel(f)).not.toMatch(/\.example\b|example\.(com|org|net)|\.test["'`/]|lorem|ipsum|datos de (demo|ejemplo|demostración)|mock|fixture|faker/i);
    }
  });

  it("no define arreglos de registros con nombres de proyectos o clientes ni tickets de ejemplo", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/nombre_proyecto:\s*["'`][^"'`]|client_name:\s*["'`][^"'`]/);
      expect(text, rel(f)).not.toMatch(/\bmessage_count:\s*\d|\bstatus:\s*["'`](abierto|en_revision|asignado|en_progreso|resuelto|cerrado|convertido)/);
    }
  });

  it("las únicas cifras literales son los límites de la base de datos, el ancho móvil y los umbrales de fecha", () => {
    const drawer = read(path.join(TICKETS_DIR, "TicketDrawer.tsx"));
    expect(drawer).toMatch(/MESSAGE_MAX = 10_000/);
    const form = read(path.join(SRC, "components/dashboard/project-detail/SubTicketForm.tsx"));
    expect(form).toMatch(/TITLE_MAX = 200/);
    expect(form).toMatch(/DESCRIPTION_MAX = 10_000/);
    expect(read(path.join(TICKETS_DIR, "useNarrowViewport.ts"))).toMatch(/NARROW_MAX_WIDTH = 640/);
  });

  it("las cifras de los indicadores salen de los datos cargados, no de literales", () => {
    const page = read(PRODUCTION[0]);
    expect(page).not.toMatch(/value=\{\s*\d/);
    expect(page).not.toMatch(/value="/);
    expect(page).toMatch(/countOpen\(tickets\)/);
  });
});

describe("código de producción del Soporte · voz y mensajes", () => {
  it("sin estilo de consola: ni «$ tickets», ni botones con corchetes, ni fuentes mono/display, ni mayúsculas forzadas", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/\$ tickets|\[ [A-ZÁÉÍÓÚ ]+ \]|cargando\.\.\.|sin tickets\./);
      expect(text, rel(f)).not.toMatch(/font-mono|font-display|glow-primary|uppercase|tracking-widest/);
    }
  });

  it("no muestra el mensaje crudo del error (e.message / err.message / String(e)) y no hay `any`", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/\b(e|err|error)\.message\b|String\((e|err|error)\)/);
      expect(text, rel(f)).not.toMatch(/:\s*any\b|\bas any\b|catch \((e|err): any/);
    }
  });

  it("los errores de carga y de acción pasan por las frases en español de `loadErrors`", () => {
    const page = read(PRODUCTION[0]);
    expect(page).toMatch(/loadErrorMessage\(error, "los tickets"\)/);
    expect(read(path.join(TICKETS_DIR, "TicketDrawer.tsx"))).toMatch(/actionErrorMessage/);
    expect(read(path.join(SRC, "components/dashboard/project-detail/SubTicketForm.tsx"))).toMatch(/actionErrorMessage/);
  });

  it("el botón de cierre del cajón se llama «Cerrar»", () => {
    expect(read(path.join(TICKETS_DIR, "TicketDrawer.tsx"))).toMatch(/closeLabel="Cerrar"/);
  });
});

describe("código de producción del Soporte · datos y sistema de diseño", () => {
  it("los componentes no consultan Supabase: solo funciones de src/lib", () => {
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/integrations\/supabase|supabase\.from|\.rpc\(/);
    }
    expect(read(PRODUCTION[0])).toMatch(/from "@\/lib\/tickets"/);
    expect(read(path.join(TICKETS_DIR, "TicketDrawer.tsx"))).toMatch(/from "@\/lib\/tickets"/);
  });

  it("sin colores crudos ni degradados ni vidrio ni sombras pesadas ni transiciones prohibidas", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, rel(f)).not.toMatch(/gradient|backdrop-blur|shadow-(md|lg|xl|2xl)|transition-all/);
    }
  });

  it("toda transición y todo giro o pulso respeta el movimiento reducido", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      for (const m of text.matchAll(/"([^"]*\btransition-(?:colors|transform|opacity)\b[^"]*)"/g)) {
        expect(m[1], `${rel(f)}: ${m[1].slice(0, 70)}`).toMatch(/motion-reduce:transition-none/);
      }
      for (const m of text.matchAll(/"([^"]*\banimate-(?:spin|pulse)\b[^"]*)"/g)) {
        expect(m[1], `${rel(f)}: ${m[1].slice(0, 70)}`).toMatch(/motion-reduce:animate-none/);
      }
    }
  });

  it("los estados, prioridades y tipos salen de los mapas reales, no de etiquetas copiadas", () => {
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/["'`](Recibido|En revisión|En progreso|Cerrado|Convertido a Proyecto|Bug \/ Error|Solicitud de Proyecto)["'`]/);
    }
  });

  it("los estados se muestran con `StatusBadge` (texto + punto), no con clases de color copiadas", () => {
    expect(read(path.join(TICKETS_DIR, "TicketTable.tsx"))).toMatch(/<StatusBadge kind="ticket"/);
    expect(read(path.join(TICKETS_DIR, "TicketTable.tsx"))).toMatch(/<StatusBadge kind="priority"/);
    expect(read(path.join(TICKETS_DIR, "TicketCards.tsx"))).toMatch(/<StatusBadge kind="ticket"/);
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/TICKET_(STATUS|PRIORITY)_CONFIG\[[^\]]+\]\.color|\.color\}/);
    }
  });
});

describe("rutas y permisos del Soporte", () => {
  it("ProtectedRoute exige declarar quién entra (sin valor por defecto)", () => {
    expect(protectedRouteSource).toContain("allowedTypes: readonly number[]");
    expect(protectedRouteSource).not.toContain("allowedTypes = [");
  });

  it("/dashboard/tickets sigue en <ProtectedRoute allowedTypes={[0]}> (solo administrador) y dentro del shell", () => {
    const bloque = appSource.split("<Route").find((c) => /path="\/dashboard\/tickets"/.test(c))!;
    expect(bloque).toBeDefined();
    expect(bloque).toContain("<ProtectedRoute allowedTypes={[0]}>");
    expect(bloque.indexOf("<ProtectedRoute")).toBeGreaterThan(-1);
    expect(bloque.indexOf("<ProtectedRoute")).toBeLessThan(bloque.indexOf("<AdminShell>"));
    expect(bloque).toContain("<TicketsGlobal />");
    expect(appSource).toMatch(/const TicketsGlobal\s*=\s*lazy\(\(\) => import\("\.\/pages\/dashboard\/TicketsGlobal\.tsx"\)\)/);
  });

  it("no apareció ninguna ruta nueva (siguen las del Resumen y la lista de proyectos)", () => {
    const paths = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    for (const p of ["/dashboard", "/dashboard/proyectos", "/dashboard/project/:id", "/dashboard/tickets", "/solicitudes"]) {
      expect(paths.filter((x) => x === p), p).toHaveLength(1);
    }
    expect(paths.filter((p) => p.startsWith("/dashboard"))).toHaveLength(4);
  });

  it("el cajón sigue siendo uno solo y lo usan la lista global y el detalle de proyecto", () => {
    const contentTabs = read(path.join(SRC, "components/dashboard/project-detail/ContentTabs.tsx"));
    expect(contentTabs).toMatch(/import TicketDrawer from "@\/components\/dashboard\/tickets\/TicketDrawer"/);
    expect(read(PRODUCTION[0])).toMatch(/import TicketDrawer from "@\/components\/dashboard\/tickets\/TicketDrawer"/);
    expect(walk(SRC).filter((f) => /TicketDrawer\.tsx$/.test(f))).toHaveLength(1);
  });

  it("la insignia de abiertos del menú sigue saliendo de `getOpenTicketsCount` (no se tocó la barra lateral)", () => {
    const shell = read(path.join(SRC, "components/admin/AdminShell.tsx"));
    expect(shell).toMatch(/getOpenTicketsCount/);
  });
});
