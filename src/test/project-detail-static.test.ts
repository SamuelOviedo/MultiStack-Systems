// Garantías estáticas del código de producción del detalle de proyecto y de los dos modales: ningún dato
// inventado, sin voz de consola, sin mensajes técnicos en pantalla (salvo los dos avisos de `ProjectDetail` que no se
// tocan por ser zona delicada), sin consultas a Supabase desde componentes, sin colores crudos, movimiento reducido,
// y los permisos y rutas que NO se deben haber cambiado.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import appSource from "@/App.tsx?raw";
import protectedRouteSource from "@/components/common/ProtectedRoute.tsx?raw";

const SRC = path.resolve(__dirname, "..");
const DETAIL_DIR = path.join(SRC, "components/dashboard/project-detail");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

const PAGE = path.join(SRC, "pages/dashboard/ProjectDetail.tsx");
const COMPONENTS = [
  ...walk(DETAIL_DIR).filter((f) => /\.(ts|tsx)$/.test(f)),
  path.join(SRC, "components/dashboard/requests/ProjectScopingModal.tsx"),
  path.join(SRC, "components/dashboard/dashboard-home/NewProjectModal.tsx"),
];
const PRODUCTION = [PAGE, ...COMPONENTS];
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");

describe("código de producción del detalle · sin datos inventados", () => {
  it("hay archivos que revisar", () => {
    expect(PRODUCTION.length).toBeGreaterThanOrEqual(14);
  });

  it("no contiene correos, teléfonos, dominios de ejemplo ni nombres de empresa o persona inventados", () => {
    // Únicos textos de ayuda del alta (placeholders de formulario, no datos; los fijó el Resumen).
    const AYUDA = ["cliente@email.com", "+504 0000-0000"];
    for (const f of PRODUCTION) {
      let text = read(f);
      for (const ayuda of AYUDA) text = text.split(ayuda).join("");
      expect(text, rel(f)).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(text, rel(f)).not.toMatch(/\+?504[\s-]?\d{4}|\b\d{4}-\d{4}\b/);
      expect(text, rel(f)).not.toMatch(/\.example\b|example\.(com|org|net)|\.test["'`/]|lorem|ipsum|datos de (demo|ejemplo|demostración)|mock|fixture|faker/i);
    }
  });

  it("no define registros con nombres de proyectos, clientes o importes, ni monedas por defecto en las etiquetas", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/nombre_proyecto:\s*["'`][^"'`]|client_name:\s*["'`][^"'`]/);
      expect(text, rel(f)).not.toMatch(/\bbilled_amount:\s*\d|\bcost_(yearly|monthly):\s*\d/);
    }
  });

  it("los placeholders de importe son un formato (0.00), no un precio de ejemplo", () => {
    for (const f of PRODUCTION) {
      for (const m of read(f).matchAll(/placeholder="(\d[^"]*)"/g)) {
        expect(m[1], rel(f)).toBe("0.00");
      }
    }
  });
});

describe("código de producción del detalle · voz y mensajes", () => {
  it("sin estilo de consola: ni «$ …», ni botones con corchetes, ni nombres de campo con dos puntos, ni mayúsculas forzadas", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/"\$ [a-zñ]|\$ servicios|\$ tickets|\$ registro|\$ acceso|\[ [A-ZÁÉÍÓÚ ]+ \]/);
      // La tipografía monoespaciada solo sirve para lo que se copia (el enlace del portal y el comienzo de un token).
      const mono = /ClientAccessSection\.tsx$/.test(f) ? "" : "font-mono|";
      expect(text, rel(f)).not.toMatch(new RegExp(mono + "font-display|glow-primary|uppercase|tracking-widest|capitalize"));
      expect(text, rel(f)).not.toMatch(/["'`>](nombre_proyecto|client_name|fecha_completado|completado_por|tareas_realizadas|monto_cobrado|nombre_cliente|email_cliente|costo_mensual|costo_anual):/);
      expect(text, rel(f)).not.toMatch(/\.\.\."|Guardando\.\.\.|Creando\.\.\.|Convirtiendo\.\.\.|Generando\.\.\./);
    }
  });

  it("los componentes no muestran el mensaje crudo del error y no hay `any`", () => {
    for (const f of COMPONENTS) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/\b(e|err|error)\.message\b|String\((e|err|error)\)/);
      expect(text, rel(f)).not.toMatch(/:\s*any\b|\bas any\b|catch \((e|err): any/);
    }
  });

  it("`ProjectDetail` conserva SIN CAMBIOS los dos avisos de su lógica (carga y guardado): pendiente documentado", () => {
    const text = read(PAGE);
    expect(text.match(/e instanceof Error \? e\.message : String\(e\)/g)).toHaveLength(2);
    expect(text).toMatch(/Promise\.all\(\[/);
    expect(text).toMatch(/navigate\("\/dashboard"\)/);
  });

  it("los avisos de acción pasan por `actionErrorMessage` (frases en español, el detalle solo al registro)", () => {
    for (const nombre of ["StageDrawer", "ServiceForm", "MaintenanceSection", "ClientAccessSection", "ContentTabs"]) {
      expect(read(path.join(DETAIL_DIR, `${nombre}.tsx`)), nombre).toMatch(/actionErrorMessage/);
    }
    expect(read(path.join(SRC, "components/dashboard/requests/ProjectScopingModal.tsx"))).toMatch(/actionErrorMessage/);
  });

  it("todos los cierres dicen «Cerrar» (cajones y modales)", () => {
    for (const nombre of ["StageDrawer", "ServiceForm", "MaintenanceSection"]) {
      expect(read(path.join(DETAIL_DIR, `${nombre}.tsx`)), nombre).toMatch(/closeLabel="Cerrar"/);
    }
    expect(read(path.join(SRC, "components/dashboard/requests/ProjectScopingModal.tsx"))).toMatch(/closeLabel="Cerrar"/);
    expect(read(path.join(SRC, "components/dashboard/dashboard-home/NewProjectModal.tsx"))).toMatch(/closeLabel="Cerrar"/);
    const dialog = read(path.join(SRC, "components/ui/dialog.tsx"));
    expect(dialog).toMatch(/closeLabel = "Close"/); // por defecto sin cambios para otros usos
    expect(dialog).toMatch(/\{closeLabel\}/);
  });
});

describe("código de producción del detalle · datos y sistema de diseño", () => {
  it("los componentes no consultan Supabase: solo funciones de src/lib", () => {
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/integrations\/supabase|supabase\.from|\.rpc\(/);
    }
  });

  it("sin colores crudos ni degradados ni vidrio ni sombras pesadas ni transiciones prohibidas", () => {
    for (const f of PRODUCTION) {
      const text = read(f);
      expect(text, rel(f)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, rel(f)).not.toMatch(/gradient|backdrop-blur|shadow-(md|lg|xl|2xl)|transition-all|text-red-|text-blue-/);
    }
  });

  it("toda transición, entrada, giro o pulso respeta el movimiento reducido", () => {
    for (const f of [...PRODUCTION, path.join(SRC, "components/ui/dialog.tsx")]) {
      const text = read(f);
      for (const m of text.matchAll(/"([^"]*\btransition-(?:colors|transform|opacity)\b[^"]*)"/g)) {
        expect(m[1], `${rel(f)}: ${m[1].slice(0, 70)}`).toMatch(/motion-reduce:transition-none/);
      }
      for (const m of text.matchAll(/"([^"]*\banimate-(?:spin|pulse|in)\b[^"]*)"/g)) {
        expect(m[1], `${rel(f)}: ${m[1].slice(0, 70)}`).toMatch(/motion-reduce:(animate-none|data-\[state=open\]:animate-none)/);
      }
    }
  });

  it("el movimiento es breve: nada supera 200 ms y las salidas son más rápidas que las entradas", () => {
    for (const f of [...PRODUCTION, path.join(SRC, "components/ui/dialog.tsx")]) {
      for (const m of read(f).matchAll(/duration-(\d+)/g)) {
        expect(Number(m[1]), `${rel(f)}: duration-${m[1]}`).toBeLessThanOrEqual(200);
      }
    }
    const motion = read(path.join(DETAIL_DIR, "panelBehavior.ts"));
    expect(motion).toMatch(/data-\[state=open\]:duration-200 data-\[state=closed\]:duration-150/);
  });

  it("los estados salen de los mapas reales y se muestran con `StatusBadge` (texto + punto o icono)", () => {
    const tabs = read(path.join(DETAIL_DIR, "ContentTabs.tsx"));
    expect(tabs).toMatch(/<StatusBadge kind="ticket"/);
    expect(tabs).toMatch(/<StatusBadge kind="priority"/);
    expect(read(PAGE)).toMatch(/<StatusBadge kind="project"/);
    for (const f of PRODUCTION) {
      expect(read(f), rel(f)).not.toMatch(/TICKET_(STATUS|PRIORITY)_CONFIG\[[^\]]+\]\.color|STATUS_CONFIG\[[^\]]+\]\.color|\.color\}/);
    }
  });

  it("las renovaciones usan las reglas del Resumen (7 días = urgente, ventana de 30) en vez de literales propios", () => {
    const tabs = read(path.join(DETAIL_DIR, "ContentTabs.tsx"));
    expect(tabs).toMatch(/isUrgentRenewal/);
    expect(tabs).toMatch(/RENEWAL_WINDOW_DAYS/);
    expect(tabs).not.toMatch(/<=\s*7\b|<=\s*30\b/);
  });

  it("el borrado de un servicio y la regeneración del enlace piden confirmación con `alert-dialog`", () => {
    expect(read(path.join(DETAIL_DIR, "ContentTabs.tsx"))).toMatch(/from "@\/components\/ui\/alert-dialog"/);
    expect(read(path.join(DETAIL_DIR, "ClientAccessSection.tsx"))).toMatch(/from "@\/components\/ui\/alert-dialog"/);
    expect(read(path.join(DETAIL_DIR, "ContentTabs.tsx"))).not.toMatch(/onClick=\{\(\) => onDeleteService/);
  });

  it("las etiquetas de los formularios se enlazan por `Field`/`FormLabel`; no quedan `<label>` sueltos sin `htmlFor`", () => {
    for (const f of PRODUCTION) {
      for (const m of read(f).matchAll(/<label\b([^>]*)>/g)) {
        expect(m[1], rel(f)).toMatch(/htmlFor=/);
      }
    }
  });

  it("los importes son `type=\"number\"` con `inputMode=\"decimal\"` y siguen guardándose con `parseFloat` / como cadena de siempre", () => {
    for (const nombre of ["ServiceForm", "MaintenanceSection", "StageDrawer"]) {
      expect(read(path.join(DETAIL_DIR, `${nombre}.tsx`)), nombre).toMatch(/type="number"[^>]*inputMode="decimal"|inputMode="decimal"[^>]*type="number"/);
    }
    expect(read(path.join(DETAIL_DIR, "MaintenanceSection.tsx"))).toMatch(/parseFloat\(form\.billed_amount\)/);
    expect(read(path.join(DETAIL_DIR, "ServiceForm.tsx"))).toMatch(/parseFloat\(form\.cost_yearly\)/);
  });

  it("el cajón de etapa no quita, renombra ni filtra claves de `metadata`", () => {
    const text = read(path.join(DETAIL_DIR, "StageDrawer.tsx"));
    expect(text).toMatch(/metadata: meta,/);
    expect(text).not.toMatch(/delete meta|Object\.fromEntries|omit\(|pick\(/);
    for (const clave of ["precio_anual", "precio_mensual", "moneda", "factura_emitida"]) {
      expect(text, clave).toContain(clave);
    }
  });
});

describe("rutas y permisos del detalle de proyecto y los modales", () => {
  it("ProtectedRoute sigue con su valor por defecto [0, 1]", () => {
    expect(protectedRouteSource).toContain("allowedTypes = [0, 1]");
  });

  it("el detalle de proyecto sigue en <ProtectedRoute> sin allowedTypes propio y dentro del shell, como antes", () => {
    const bloque = appSource.split("<Route").find((c) => /path="\/dashboard\/project\/:id"/.test(c))!;
    expect(bloque).toBeDefined();
    expect(bloque).not.toMatch(/allowedTypes/);
    expect(bloque.indexOf("<ProtectedRoute")).toBeGreaterThan(-1);
    expect(bloque.indexOf("<ProtectedRoute")).toBeLessThan(bloque.indexOf("<AdminShell>"));
    expect(bloque).toContain("<ProjectDetail />");
    expect(appSource).toMatch(/const ProjectDetail\s*=\s*lazy\(\(\) => import\("\.\/pages\/dashboard\/ProjectDetail\.tsx"\)\)/);
  });

  it("las demás rutas conservan sus permisos: solo /solicitudes lleva allowedTypes={[2]}", () => {
    const rutas = appSource.split("<Route").filter((c) => /path="\/(dashboard|solicitudes)/.test(c));
    expect(rutas).toHaveLength(5);
    const conPermiso = rutas.filter((c) => /allowedTypes/.test(c));
    expect(conPermiso).toHaveLength(1);
    expect(conPermiso[0]).toMatch(/path="\/solicitudes"/);
    expect(conPermiso[0]).toMatch(/allowedTypes=\{\[2\]\}/);
  });

  it("no apareció ninguna ruta nueva (siguen las del Resumen y la lista de proyectos)", () => {
    const paths = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    for (const p of ["/dashboard", "/dashboard/proyectos", "/dashboard/project/:id", "/dashboard/tickets", "/solicitudes"]) {
      expect(paths.filter((x) => x === p), p).toHaveLength(1);
    }
    expect(paths.filter((p) => p.startsWith("/dashboard"))).toHaveLength(4);
  });

  it("el modal de alcance sigue siendo uno solo y lo usan el Resumen y el cajón de tickets", () => {
    expect(walk(SRC).filter((f) => /ProjectScopingModal\.tsx$/.test(f))).toHaveLength(1);
    expect(walk(SRC).filter((f) => /NewProjectModal\.tsx$/.test(f))).toHaveLength(1);
  });
});
