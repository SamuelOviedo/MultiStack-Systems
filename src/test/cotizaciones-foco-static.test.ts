// Guarda estática del margen de scroll de las pantallas de Cotizaciones frente a la cabecera fija (WCAG 2.2, 2.4.11
// «Foco no oculto»).
//
// La cabecera del armazón del panel es fija y el scroll vertical lo hace el documento. Cuando el navegador lleva a la
// vista el control que recibe el foco (con Shift+Tab, o por código tras «Reintentar») lo deja pegado al borde de la
// ventana, es decir, debajo de la cabecera. El margen de scroll de cada control le dice al navegador cuánto espacio
// dejar por encima, y tiene que ser MAYOR que la cabecera más el anillo de foco.
//
// Esta prueba liga las dos cifras leyendo el código fuente (las clases de Tailwind no tienen efecto en jsdom): si
// alguien cambia la altura o la posición de la cabecera, o quita el margen de alguno de los sitios, falla con un
// mensaje que dice qué cifra mover. La medición real, en Chromium, está en `e2e/cotizaciones-foco.spec.ts`.
//
// Ojo: Tailwind lee también los archivos de prueba bajo `src/` y convierte en regla de CSS de producción todo lo que
// parezca una de sus clases, hasta dentro de un comentario o de un literal. Por eso los nombres de clase de este
// archivo se arman en ejecución y los comentarios no los citan.
import { describe, expect, it } from "vitest";
import detalleFuente from "@/pages/dashboard/CotizacionDetalle.tsx?raw";
import listadoFuente from "@/pages/dashboard/CotizacionesList.tsx?raw";
import armazonFuente from "@/components/admin/AdminShell.tsx?raw";

const lf = (texto: string) => texto.replace(/\r\n/g, "\n");
const DETALLE = lf(detalleFuente);
const LISTADO = lf(listadoFuente);
const ARMAZON = lf(armazonFuente);

/** Une partes con guion: así ninguna clase de Tailwind aparece escrita entera en este archivo. */
const clase = (...partes: string[]) => partes.join("-");
const MARGEN = clase("scroll", "mt");
const ALTURA = "h";
const ARRIBA = "top";

/** Anillo de foco más ancho de estas pantallas: el anillo de 2 px más su separación de 2 px en botones y grupos. */
const ANILLO_MAXIMO_PX = 4;

/** Valor de una clase de la escala (1 = 4 px) o con corchetes, en píxeles; `null` si no sabemos leerlo. */
function pixeles(valor: string): number | null {
  if (/^\d+(\.\d+)?$/.test(valor)) return Number(valor) * 4;
  const arbitrario = /^\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(valor);
  if (arbitrario) return Number(arbitrario[1]) * (arbitrario[2] === "rem" ? 16 : 1);
  return null;
}

/** Valor en px de la primera clase `<prefijo>-<valor>` de una lista de clases, o `null` si no hay o no se sabe leer. */
function claseEnPx(clases: string, prefijo: string): number | null {
  for (const candidata of clases.split(/\s+/)) {
    if (candidata.startsWith(`${prefijo}-`)) return pixeles(candidata.slice(prefijo.length + 1));
  }
  return null;
}

function cabeceraFija(): { altura: number; arriba: number } {
  const candidatas = [...ARMAZON.matchAll(/<header\s+className="([^"]+)"/g)].map((m) => m[1]).filter((c) => /\bsticky\b/.test(c));
  expect(
    candidatas,
    "AdminShell.tsx debe tener UNA cabecera fija (header con la clase sticky) con las clases como texto literal. " +
      "Si cambió su forma, actualiza esta guarda y revisa el margen de scroll de las pantallas de Cotizaciones.",
  ).toHaveLength(1);
  const altura = claseEnPx(candidatas[0], ALTURA);
  expect(altura, `no se pudo leer la altura (${ALTURA}-N) de la cabecera fija: «${candidatas[0]}»`).not.toBeNull();
  const arriba = new RegExp(`\\b${ARRIBA}-`).test(candidatas[0]) ? claseEnPx(candidatas[0], ARRIBA) : 0;
  expect(arriba, `no se pudo leer la posición (${ARRIBA}-N) de la cabecera fija: «${candidatas[0]}»`).not.toBeNull();
  return { altura: altura as number, arriba: arriba as number };
}

/** El valor de `className="…"` de un fragmento de JSX (la etiqueta de apertura), o `null` si no hay fragmento. */
const clasesDe = (fragmento: string | undefined): string | null =>
  fragmento === undefined ? null : (/className="([^"]*)"/.exec(fragmento)?.[1] ?? "");

/** Etiqueta de apertura de un `div` identificado por su `aria-label`. */
const divConEtiqueta = (fuente: string, etiqueta: string) =>
  new RegExp(`<div\\s[^>]*?aria-label="${etiqueta}"[^>]*>`, "s").exec(fuente)?.[0];

interface Sitio {
  nombre: string;
  clases: string | null;
}

/** Los sitios de las pantallas que el foco puede alcanzar con la cabecera encima, con sus clases. */
function sitios(): Sitio[] {
  const region = /containerProps=\{\{[\s\S]*?\n\s*\}\}/.exec(LISTADO)?.[0];
  return [
    { nombre: "listado · enlace de referencia de cada fila", clases: clasesDe(/<Link\s[^>]*?to=\{`[^`]*\$\{c\.id\}`\}[^>]*>/s.exec(LISTADO)?.[0]) },
    { nombre: "listado · región de la tabla (role=region, tabIndex 0)", clases: region === undefined ? null : (/className:\s*"([^"]*)"/.exec(region)?.[1] ?? "") },
    { nombre: "listado · botón «Ver catálogo»", clases: clasesDe(/<Button\s[^>]*asChild[^>]*>\s*<Link to="\/dashboard\/cotizaciones\/catalogo"/.exec(LISTADO)?.[0]) },
    { nombre: "listado · grupo «Listado de cotizaciones» (foco por código)", clases: clasesDe(divConEtiqueta(LISTADO, "Listado de cotizaciones")) },
    { nombre: "detalle · enlace «Volver a cotizaciones»", clases: clasesDe(/<Link\s+to="\/dashboard\/cotizaciones"\s+className="[^"]*"/.exec(DETALLE)?.[0]) },
    { nombre: "detalle · grupo «Detalle de la cotización» (foco por código)", clases: clasesDe(divConEtiqueta(DETALLE, "Detalle de la cotización")) },
  ];
}

describe("T024 · margen de scroll frente a la cabecera fija (2.4.11)", () => {
  it("lee los archivos (la guarda no pasa en vacío)", () => {
    expect(ARMAZON.length).toBeGreaterThan(1000);
    expect(LISTADO.length).toBeGreaterThan(1000);
    expect(DETALLE.length).toBeGreaterThan(1000);
    expect(LISTADO).toContain("despejarRegionBajoCabecera");
  });

  it("encuentra los seis sitios en el código fuente", () => {
    const encontrados = sitios();
    expect(encontrados).toHaveLength(6);
    for (const { nombre, clases } of encontrados) {
      expect(clases, `no se encontró el sitio «${nombre}» en el código fuente (¿cambió su forma?)`).not.toBeNull();
    }
  });

  it("cada sitio deja por encima más que la cabecera fija más el anillo de foco", () => {
    const { altura, arriba } = cabeceraFija();
    const minimo = arriba + altura + ANILLO_MAXIMO_PX;
    for (const { nombre, clases } of sitios()) {
      const margen = claseEnPx(clases ?? "", MARGEN);
      expect(
        margen,
        `«${nombre}» no tiene margen de scroll (${MARGEN}-N): con Shift+Tab, o tras «Reintentar», su foco quedaría ` +
          `bajo la cabecera fija de ${altura} px (WCAG 2.4.11)`,
      ).not.toBeNull();
      expect(
        margen as number,
        `«${nombre}»: el margen de scroll es de ${margen} px, pero la cabecera fija ocupa ${arriba + altura} px y el ` +
          `anillo de foco llega a ${ANILLO_MAXIMO_PX} px: hacen falta al menos ${minimo} px`,
      ).toBeGreaterThanOrEqual(minimo);
    }
  });

  it("la región usa el manejador que la despeja al enfocarla con el teclado", () => {
    const region = /containerProps=\{\{[\s\S]*?\n\s*\}\}/.exec(LISTADO)?.[0] ?? "";
    expect(region).toMatch(/onFocus:\s*despejarRegionBajoCabecera\b/);
  });

  describe("el lector de clases de la guarda", () => {
    it("lee la escala, los valores con corchetes y rechaza lo desconocido", () => {
      expect(claseEnPx([clase("sticky"), clase(ARRIBA, "0"), clase(ALTURA, "14")].join(" "), ALTURA)).toBe(56);
      expect(claseEnPx(clase(MARGEN, "16"), MARGEN)).toBe(64);
      expect(claseEnPx(clase(MARGEN, "[72px]"), MARGEN)).toBe(72);
      expect(claseEnPx(clase(MARGEN, "[4.5rem]"), MARGEN)).toBe(72);
      expect(claseEnPx(clase(MARGEN, "0.5"), MARGEN)).toBe(2);
      expect(claseEnPx(clase(ALTURA, "dvh"), ALTURA)).toBeNull();
      expect(claseEnPx("sin-ninguna", MARGEN)).toBeNull();
    });
  });
});
