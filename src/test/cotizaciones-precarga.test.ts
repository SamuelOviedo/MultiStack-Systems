// Visita directa a Cotizaciones: `preloadPanelForPath` pide a la vez el armazón y la página de la lista (dos chunks
// perezosos). El módulo de precarga es el real; el armazón y las páginas se sustituyen por módulos mínimos que anotan
// cada vez que se cargan. Se registran de nuevo (`vi.doMock`) y el módulo de precarga se importa otra vez en cada
// prueba: `vi.mock` guarda el resultado de su fábrica y una segunda carga no se vería.
import { beforeEach, describe, expect, it, vi } from "vitest";

const MODULOS = {
  "@/components/admin/AdminShell": "AdminShell",
  "@/pages/dashboard/Dashboard": "Dashboard",
  "@/pages/dashboard/ProjectsList": "ProjectsList",
  "@/pages/dashboard/TicketsGlobal": "TicketsGlobal",
  "@/pages/dashboard/CotizacionesList": "CotizacionesList",
  "@/pages/dashboard/CotizacionesCatalogo": "CotizacionesCatalogo",
  "@/pages/dashboard/CotizacionDetalle": "CotizacionDetalle",
} as const;

const UUID = "0a1b2c3d-0007-4000-8000-000000000007";
const cargados: string[] = [];
let fallar = false;

/** Pide la precarga de `ruta` con un módulo recién importado y devuelve, ordenado, lo que se cargó. */
async function precargar(ruta: string): Promise<string[]> {
  const { preloadPanelForPath } = await import("@/components/admin/preloadPanel");
  preloadPanelForPath(ruta);
  // Las cargas son `import()` dinámicos: Vitest espera a que terminen todas (sin plazo fijo).
  await vi.dynamicImportSettled();
  return [...cargados].sort();
}

beforeEach(() => {
  cargados.length = 0;
  fallar = false;
  vi.resetModules();
  for (const [ruta, nombre] of Object.entries(MODULOS)) {
    vi.doMock(ruta, () => {
      if (fallar && nombre === "CotizacionesList") throw new Error("fallo simulado de la carga");
      cargados.push(nombre);
      return { default: () => null };
    });
  }
});

describe("precarga de la visita directa al panel", () => {
  it.each([
    ["/dashboard", ["AdminShell", "Dashboard"]],
    ["/dashboard/proyectos", ["AdminShell", "ProjectsList"]],
    ["/dashboard/tickets", ["AdminShell", "TicketsGlobal"]],
  ])("control: %s sigue pidiendo el armazón y su página, y nada más", async (ruta, esperado) => {
    expect(await precargar(ruta)).toEqual(esperado);
  });

  it.each(["/dashboard/cotizaciones", "/dashboard/cotizaciones/", "/dashboard/cotizaciones//"])(
    "%s pide el armazón y la lista de Cotizaciones, una vez cada uno, y nada más",
    async (ruta) => {
      expect(await precargar(ruta)).toEqual(["AdminShell", "CotizacionesList"]);
    },
  );

  it.each([
    "/dashboard/cotizaciones/catalogo",
    `/dashboard/cotizaciones/${UUID}`,
    "/dashboard/cotizaciones/x/y",
    "/dashboard/cotizacion",
    "/dashboard/cotizacionesx",
  ])("%s no precarga nada (solo la lista de Cotizaciones tiene entrada)", async (ruta) => {
    expect(await precargar(ruta)).toEqual([]);
  });

  it("si la carga de la lista falla, la precarga lo ignora (React.lazy lo reintentará y lo mostrará donde corresponde)", async () => {
    fallar = true;
    const sinAtender: unknown[] = [];
    const alRechazarSinAtender = (motivo: unknown) => {
      sinAtender.push(motivo);
    };
    process.on("unhandledRejection", alRechazarSinAtender);
    try {
      const { preloadPanelForPath } = await import("@/components/admin/preloadPanel");
      expect(() => preloadPanelForPath("/dashboard/cotizaciones")).not.toThrow();
      await vi.dynamicImportSettled();
    } finally {
      process.off("unhandledRejection", alRechazarSinAtender);
    }
    // El fallo de la carga no queda como rechazo sin atender (Vitest lo contaría como error de toda la ejecución).
    expect(sinAtender).toEqual([]);
    expect(cargados).toContain("AdminShell");
    expect(cargados).not.toContain("CotizacionesList");
  });
});
