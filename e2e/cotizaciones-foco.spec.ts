import { test, expect, type Page } from "@playwright/test";
import { USERS, mockSupabase, signIn, type RestHandler } from "./support/supabase-simulado";

// Foco no oculto por la cabecera fija (WCAG 2.2, 2.4.11, AA) en el listado de cotizaciones, en Chromium real y con
// Supabase SIMULADO (ninguna petición sale a la red; ver `e2e/support/supabase-simulado.ts`). Datos 100 % sintéticos.
//
// Defecto que cubre: la cabecera del armazón (`header.sticky top-0 z-20 h-14`, 56 px) tapaba el foco de los enlaces de
// referencia al retroceder con Shift+Tab, porque el scroll vertical lo hace el documento y el navegador deja el
// control pegado al borde de la ventana. La corrección es `scroll-mt-16` en los controles del listado más un
// manejador `onFocus` en la región de la tabla. Qué se mide: para CADA parada de foco del contenido, el anillo
// (rectángulo del control ensanchado por su anillo) no pasa bajo la cabecera y `elementFromPoint` en sus cuatro
// esquinas (y en el centro del borde superior) no cae sobre la cabecera. No cuentan los controles de la propia
// cabecera, el menú lateral ni el enlace «Saltar al contenido». Sin esperas fijas: se espera a que el scroll se asiente.
//
// También cubre (a) el detalle a 320×480 y 390×560 con la página ya desplazada y Shift+Tab hasta «Volver a
// cotizaciones», y (b) el foco que mueve el propio código tras «Reintentar» (listado y detalle) y «Volver a la primera
// página»: el navegador alinea el contenedor al borde superior de la ventana y su anillo quedaría bajo la cabecera.

/** Treinta cotizaciones sintéticas: la primera página (25) trae «Siguiente» y la tabla es mucho más alta que la ventana. */
const TOTAL = 30;
const POR_PAGINA = 25;
const ESTADOS = ["borrador", "emitida", "aceptada_firmada", "rechazada", "cancelada"] as const;
const pad = (n: number) => String(n).padStart(12, "0");
const FILAS = Array.from({ length: TOTAL }, (_, i) => {
  const n = TOTAL - i; // de la más reciente (BOR-30) a la más antigua (BOR-1)
  return {
    id: `c2000000-0000-4000-8000-${pad(n)}`,
    referencia_interna: `BOR-${n}`,
    estado: ESTADOS[n % ESTADOS.length],
    prospecto_nombre: `Empresa Sintetica ${n}`,
    prospecto_contacto: `Contacto Sintetico ${n}`,
    prospecto_email: `p${n}@example.test`,
    prospecto_telefono: `+000 555 ${String(n).padStart(4, "0")}`,
    creado_por: USERS[0].id,
    creado_at: `2026-11-${String(Math.min(28, n)).padStart(2, "0")}T21:30:00+00:00`,
    actualizado_por: null,
    actualizado_at: "2026-11-10T14:05:00+00:00",
    row_version: 1,
  } as Record<string, string | number | null>;
});
const REFERENCIAS_DE_LA_PAGINA = FILAS.slice(0, POR_PAGINA).map((fila) => String(fila.referencia_interna));

/** Lo que el simulacro hace en cada momento: por defecto responde bien; las pruebas de foco programático lo estropean a propósito. */
interface EstadoDelServidor {
  /** Toda lectura de cotizaciones responde 500 (la pantalla enseña «Reintentar»). */
  fallar: boolean;
  /** Las páginas siguientes a la primera vienen vacías (la pantalla enseña «Volver a la primera página»). */
  paginaSiguienteVacia: boolean;
}

/**
 * Como PostgREST con lo que pide la capa de datos: el detalle filtra por `id=eq.<uuid>` y devuelve un arreglo de 0 o 1
 * fila; el listado respeta `offset`/`limit` y entrega solo las columnas de `select`.
 */
function crearServidor() {
  const estado: EstadoDelServidor = { fallar: false, paginaSiguienteVacia: false };
  const handler: RestHandler = ({ table, method, url }) => {
    if (table !== "cotizaciones" || method !== "GET") return undefined;
    if (estado.fallar) return { status: 500, body: { code: "XX000", message: "fallo sintético del simulacro", details: null, hint: null } };
    const columnas = (url.searchParams.get("select") ?? "").split(",").map((columna) => columna.trim());
    const entregar = (filas: typeof FILAS) => ({ body: filas.map((fila) => Object.fromEntries(columnas.map((c) => [c, fila[c]]))) });
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (id !== undefined) return entregar(FILAS.filter((fila) => fila.id === id));
    const desde = Number(url.searchParams.get("offset") ?? "0");
    const limite = Number(url.searchParams.get("limit") ?? FILAS.length);
    if (estado.paginaSiguienteVacia && desde > 0) return { body: [] };
    return entregar(FILAS.slice(desde, desde + limite));
  };
  return { estado, handler, reiniciar: () => Object.assign(estado, { fallar: false, paginaSiguienteVacia: false }) };
}
type Servidor = ReturnType<typeof crearServidor>;
const servirCotizaciones = crearServidor().handler;

const LISTA = "/dashboard/cotizaciones";
const NOMBRE_DE_LA_REGION = "Tabla de cotizaciones, se desplaza en horizontal";

/** Lo que mide, en la página, la parada de foco actual. Sin referencias externas: se serializa tal cual al navegador. */
interface Parada {
  /** `false` si el foco está en <body> (fuera del documento). */
  hayFoco: boolean;
  nombre: string;
  /** Control de la cabecera, del menú lateral o «Saltar al contenido»: no se mide. */
  excluida: boolean;
  esRegion: boolean;
  arriba: number;
  abajo: number;
  /** Cuánto sobresale el anillo de foco por fuera del control, en px (0 si es un anillo interior). */
  anillo: number;
  /** Borde superior del control menos el borde inferior de la cabecera fija. */
  holgura: number;
  scrollY: number;
  /** Cada motivo por el que el foco no se vería bien. Vacío = bien. */
  problemas: string[];
}

function medirParada(): Parada {
  const cabeceraFija = Array.from(document.querySelectorAll("header")).find((h) => getComputedStyle(h).position === "sticky");
  const el = document.activeElement as HTMLElement | null;
  if (!cabeceraFija) throw new Error("no hay una cabecera fija (header con position: sticky) en la página");
  const sin = { hayFoco: false, nombre: "(sin foco)", excluida: true, esRegion: false, arriba: 0, abajo: 0, anillo: 0, holgura: 0, scrollY: Math.round(scrollY), problemas: [] };
  if (!el || el === document.body) return sin;

  const cabecera = cabeceraFija.getBoundingClientRect();
  const nombre = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const excluida = cabeceraFija.contains(el) || el.closest("#admin-sidebar") !== null || el.matches('a[href="#contenido"]');
  const esRegion = el.getAttribute("role") === "region";
  const caja = el.getBoundingClientRect();

  // Cuánto sobresale el anillo: las capas de `box-shadow` sin desenfoque ni desplazamiento (los anillos de Tailwind,
  // que no son `inset`) y el contorno si lo hay. Un anillo interior (la región) no sobresale.
  const estilo = getComputedStyle(el);
  let anillo = 0;
  if (estilo.boxShadow !== "none") {
    for (const capa of estilo.boxShadow.split(/,(?![^(]*\))/)) {
      if (/\binset\b/.test(capa)) continue;
      const cifras = (capa.replace(/(?:rgba?|color|oklch|oklab|lab|lch|hsla?)\([^)]*\)/g, "").match(/-?\d+(?:\.\d+)?px/g) ?? []).map(parseFloat);
      const [x = 0, y = 0, desenfoque = 0, expansion = 0] = cifras;
      if (x === 0 && y === 0 && desenfoque === 0) anillo = Math.max(anillo, expansion);
    }
  }
  // `outline-none` de Tailwind deja un contorno transparente de 2 px (para el modo de colores forzados): no se ve, no cuenta.
  const contornoVisible = !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(estilo.outlineColor);
  if (contornoVisible && estilo.outlineStyle !== "none" && parseFloat(estilo.outlineWidth) > 0) {
    anillo = Math.max(anillo, parseFloat(estilo.outlineWidth) + (parseFloat(estilo.outlineOffset) || 0));
  }

  const problemas: string[] = [];
  if (!excluida) {
    const arribaDelAnillo = caja.top - anillo;
    if (arribaDelAnillo < cabecera.bottom - 0.01) {
      problemas.push(`el anillo empieza en y=${arribaDelAnillo.toFixed(1)}, bajo la cabecera (que acaba en y=${cabecera.bottom})`);
    }
    const izquierda = caja.left - anillo + 0.5;
    const derecha = caja.right + anillo - 0.5;
    const superior = arribaDelAnillo + 0.5;
    const inferior = caja.bottom + anillo - 0.5;
    const puntos: Array<[string, number, number]> = [
      ["esquina superior izquierda", izquierda, superior],
      ["esquina superior derecha", derecha, superior],
      ["esquina inferior izquierda", izquierda, inferior],
      ["esquina inferior derecha", derecha, inferior],
      ["centro del borde superior", (izquierda + derecha) / 2, superior],
    ];
    for (const [donde, x, y] of puntos) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue; // fuera de la ventana: no hay nada que tape
      const golpe = document.elementFromPoint(x, y);
      if (golpe && cabeceraFija.contains(golpe)) problemas.push(`${donde} (${x.toFixed(0)}, ${y.toFixed(0)}) cae sobre la cabecera`);
    }
    // Un control tiene que quedar a la vista; la región y los grupos de contenido (más altos que la ventana) solo en su borde superior.
    const masAltoQueLaVentana = caja.height > innerHeight - cabecera.height;
    if (!esRegion && !masAltoQueLaVentana && (caja.top < 0 || caja.bottom > innerHeight)) {
      problemas.push(`queda fuera de la ventana (y=${caja.top.toFixed(1)}..${caja.bottom.toFixed(1)} de ${innerHeight})`);
    }
  }
  return {
    hayFoco: true,
    nombre,
    excluida,
    esRegion,
    arriba: Math.round(caja.top * 10) / 10,
    abajo: Math.round(caja.bottom * 10) / 10,
    anillo,
    holgura: Math.round((caja.top - cabecera.bottom) * 10) / 10,
    scrollY: Math.round(scrollY),
    problemas,
  };
}

/** Espera (por condición, no por tiempo) a que el scroll lleve tres fotogramas seguidos sin moverse. */
const esperarScrollAsentado = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolver) => {
        let ultimo = scrollY;
        let quietos = 0;
        const paso = () => {
          if (scrollY === ultimo) quietos += 1;
          else {
            quietos = 0;
            ultimo = scrollY;
          }
          if (quietos >= 3) resolver();
          else requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      }),
  );

async function pulsarYMedir(page: Page, tecla: "Tab" | "Shift+Tab"): Promise<Parada> {
  await page.keyboard.press(tecla);
  await esperarScrollAsentado(page);
  return page.evaluate(medirParada);
}

const describir = (p: Parada) => `«${p.nombre}» (arriba=${p.arriba}, holgura sobre la cabecera=${p.holgura}, scrollY=${p.scrollY}): ${p.problemas.join("; ")}`;

/** Lo que tiene que haberse recorrido para que la comprobación no pase en vacío. */
function exigirRecorridoCompleto(contenido: Parada[]) {
  const holguras = contenido.map((p) => p.holgura);
  test.info().annotations.push({ type: "paradas", description: `${contenido.length} paradas del contenido; menor holgura sobre la cabecera: ${Math.min(...holguras)} px` });
  expect(
    contenido.map((p) => p.nombre),
    "el recorrido tiene que pasar por las 25 referencias, la región de la tabla, «Ver catálogo» y «Página siguiente»",
  ).toEqual(expect.arrayContaining([...REFERENCIAS_DE_LA_PAGINA, NOMBRE_DE_LA_REGION, "Ver catálogo", "Página siguiente"]));
  expect(contenido.some((p) => p.esRegion)).toBe(true);
}

async function abrirListado(page: Page, ancho: number, alto: number, tema: "light" | "dark") {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.addInitScript((t) => window.localStorage.setItem("theme", t), tema);
  await signIn(page, 0);
  await page.goto(LISTA);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(POR_PAGINA + 1, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Página siguiente" })).toBeVisible();
  // Control: el tema pedido es el que está puesto (si no, "oscuro" probaría el claro).
  await expect(page.locator("html")).toHaveClass(tema === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
  // Control: la cabecera es fija y mide lo que el defecto suponía.
  expect(await page.evaluate(() => Array.from(document.querySelectorAll("header")).filter((h) => getComputedStyle(h).position === "sticky").length)).toBe(1);
}

const ESCENARIOS = [
  { nombre: "1280x560 claro", ancho: 1280, alto: 560, tema: "light" },
  { nombre: "1280x560 oscuro", ancho: 1280, alto: 560, tema: "dark" },
  { nombre: "320x480 claro (armazón móvil)", ancho: 320, alto: 480, tema: "light" },
  { nombre: "320x480 oscuro (armazón móvil)", ancho: 320, alto: 480, tema: "dark" },
] as const;

test.describe("Quotations list: keyboard focus is never hidden by the sticky header (WCAG 2.4.11)", () => {
  for (const { nombre, ancho, alto, tema } of ESCENARIOS) {
    test(`Shift+Tab from the end, ${nombre}: no stop of the content is covered by the header`, async ({ page, context, baseURL }) => {
      await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
      await abrirListado(page, ancho, alto, tema);

      // Desde el final del contenido: el último control, «Página siguiente».
      await page.getByRole("button", { name: "Página siguiente" }).focus();
      await esperarScrollAsentado(page);
      const paradas: Parada[] = [await page.evaluate(medirParada)];
      for (let pasos = 0; pasos < 120; pasos += 1) {
        const parada = await pulsarYMedir(page, "Shift+Tab");
        // El contenido va después de la cabecera en el orden del documento: al pasar a la cabecera ya no queda más.
        if (parada.excluida) break;
        paradas.push(parada);
      }
      const contenido = paradas.filter((p) => !p.excluida);

      exigirRecorridoCompleto(contenido);
      expect(contenido.filter((p) => p.problemas.length > 0).map(describir), "paradas con el foco tapado o fuera de la ventana").toEqual([]);
    });

    test(`Tab forward, ${nombre}: no stop of the content is covered by the header`, async ({ page, context, baseURL }) => {
      await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
      await abrirListado(page, ancho, alto, tema);

      // Desde el principio de la página, como una persona que acaba de llegar: sin foco y arriba del todo.
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await esperarScrollAsentado(page);
      const paradas: Parada[] = [];
      for (let pasos = 0; pasos < 150; pasos += 1) {
        const parada = await pulsarYMedir(page, "Tab");
        paradas.push(parada);
        if (parada.nombre === "Página siguiente") break;
      }
      const contenido = paradas.filter((p) => !p.excluida);

      exigirRecorridoCompleto(contenido);
      expect(contenido.filter((p) => p.problemas.length > 0).map(describir), "paradas con el foco tapado o fuera de la ventana").toEqual([]);
    });
  }

  for (const { nombre, ancho, alto } of [ESCENARIOS[0], ESCENARIOS[2]]) {
    test(`a mouse click on a cell with the page scrolled does not move the scroll, ${nombre}`, async ({ page, context, baseURL }) => {
      await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
      await abrirListado(page, ancho, alto, "light");

      // Página desplazada hasta que el borde superior de la región quede por encima de la cabecera: justo la situación
      // en la que un manejador que desplaza con cualquier foco movería la página bajo el puntero.
      const y = 300;
      await page.evaluate((destino) => window.scrollTo(0, destino), y);
      await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(y);
      await esperarScrollAsentado(page);

      const objetivo = await page.evaluate(() => {
        const cabecera = Array.from(document.querySelectorAll("header")).find((h) => getComputedStyle(h).position === "sticky")!;
        const region = document.querySelector('[role="region"][tabindex="0"]')!;
        // Una celda sin enlace, entera a la vista en vertical y con al menos 12 px a la vista en horizontal.
        const celda = Array.from(region.querySelectorAll("tbody td")).find((td) => {
          const r = td.getBoundingClientRect();
          const izquierda = Math.max(r.left, 0);
          const derecha = Math.min(r.right, innerWidth);
          return td.querySelector("a") === null && r.top > cabecera.getBoundingClientRect().bottom + 8 && r.bottom < innerHeight - 8 && derecha - izquierda >= 12;
        })!;
        const r = celda.getBoundingClientRect();
        return { x: Math.max(r.left, 0) + 6, y: r.top + r.height / 2, regionArriba: region.getBoundingClientRect().top };
      });
      // Control: el borde superior de la región está por encima del margen de scroll (64 px), o la prueba no probaría nada.
      expect(objetivo.regionArriba).toBeLessThan(64);

      await page.mouse.click(objetivo.x, objetivo.y);
      // El clic lleva el foco a la región (es el ancestro enfocable de la celda): ahí actuaría el manejador.
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("region");
      await esperarScrollAsentado(page);
      expect(await page.evaluate(() => Math.round(scrollY))).toBe(y);
    });
  }
});

/**
 * Detalle con la página desplazada de antemano y foco que mueve el propio código (T024).
 * Mismo criterio de medición que arriba: el anillo del control no queda bajo la cabecera fija.
 */
const DETALLE = `${LISTA}/${FILAS[0].id}`;
const NOMBRE_DE_VOLVER = "Volver a cotizaciones";

test.describe("Quotation detail: «Volver a cotizaciones» is not hidden by the sticky header when the page was scrolled beforehand", () => {
  for (const { nombre, ancho, alto } of [
    { nombre: "320x480", ancho: 320, alto: 480 },
    { nombre: "390x560", ancho: 390, alto: 560 },
  ]) {
    test(`Shift+Tab with the page scrolled 30 to 90 px, ${nombre}`, async ({ page, context, baseURL }) => {
      await mockSupabase(context, baseURL!, 0, 0, undefined, crearServidor().handler);
      await page.setViewportSize({ width: ancho, height: alto });
      await signIn(page, 0);

      const tapados: string[] = [];
      const holguras: number[] = [];
      for (const y of [30, 50, 70, 90]) {
        // Carga limpia en cada vuelta: así Shift+Tab parte del final del documento, donde está «Volver a cotizaciones».
        await page.goto(DETALLE);
        await expect(page.getByRole("heading", { level: 1, name: `Cotización ${FILAS[0].referencia_interna}` })).toBeVisible({ timeout: 15000 });
        // Control: la página se puede desplazar al menos hasta `y`, o la vuelta no probaría nada.
        expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThanOrEqual(y);
        await page.evaluate((destino) => window.scrollTo(0, destino), y);
        await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(y);
        await esperarScrollAsentado(page);

        const parada = await pulsarYMedir(page, "Shift+Tab");
        expect(parada.nombre, `con la página en y=${y}, Shift+Tab debe llegar a «${NOMBRE_DE_VOLVER}»`).toBe(NOMBRE_DE_VOLVER);
        holguras.push(parada.holgura);
        if (parada.problemas.length > 0) tapados.push(`desplazada ${y} px: ${describir(parada)}`);
      }
      test.info().annotations.push({ type: "holguras", description: `menor holgura sobre la cabecera: ${Math.min(...holguras)} px` });
      expect(tapados, "«Volver a cotizaciones» tapado o fuera de la ventana").toEqual([]);
    });
  }
});

interface FlujoProgramatico {
  nombre: string;
  /** Deja la pantalla en el estado corto desde el que se pulsa el botón. */
  preparar: (page: Page, servidor: Servidor) => Promise<void>;
  boton: string;
  /** Lo que sigue a la pulsación, ya pintado. */
  esperarResultado: (page: Page) => Promise<void>;
  /** Nombre accesible del contenedor al que la pantalla mueve el foco. */
  grupo: string;
}

const FLUJOS: readonly FlujoProgramatico[] = [
  {
    nombre: "list: «Reintentar» after an error",
    async preparar(page, servidor) {
      servidor.estado.fallar = true;
      await page.goto(LISTA);
      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 15000 });
    },
    boton: "Reintentar",
    esperarResultado: (page) => expect(page.getByRole("table")).toBeVisible({ timeout: 15000 }),
    grupo: "Listado de cotizaciones",
  },
  {
    nombre: "list: «Volver a la primera página» from an empty page",
    async preparar(page, servidor) {
      await page.goto(LISTA);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      servidor.estado.paginaSiguienteVacia = true;
      await page.getByRole("button", { name: "Página siguiente" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Esta página no tiene cotizaciones" })).toBeVisible({ timeout: 15000 });
    },
    boton: "Volver a la primera página",
    esperarResultado: (page) => expect(page.getByRole("table")).toBeVisible({ timeout: 15000 }),
    grupo: "Listado de cotizaciones",
  },
  {
    nombre: "detail: «Reintentar» after an error",
    async preparar(page, servidor) {
      servidor.estado.fallar = true;
      await page.goto(DETALLE);
      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 15000 });
    },
    boton: "Reintentar",
    esperarResultado: (page) => expect(page.getByRole("heading", { level: 1, name: `Cotización ${FILAS[0].referencia_interna}` })).toBeVisible({ timeout: 15000 }),
    grupo: "Detalle de la cotización",
  },
];

test.describe("Programmatic focus after «Reintentar» / «Volver a la primera página» is not hidden by the sticky header", () => {
  for (const flujo of FLUJOS) {
    test(`${flujo.nombre}, 320x480, page scrolled to the top, the middle and the end of the short state`, async ({ page, context, baseURL }) => {
      const servidor = crearServidor();
      await mockSupabase(context, baseURL!, 0, 0, undefined, servidor.handler);
      await page.setViewportSize({ width: 320, height: 480 });
      await signIn(page, 0);

      // Cuánto se puede desplazar el estado corto (error o página vacía).
      servidor.reiniciar();
      await flujo.preparar(page, servidor);
      const maximo = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
      const alturas = [...new Set([0, Math.floor(maximo / 2), maximo])];

      const tapados: string[] = [];
      for (const y of alturas) {
        servidor.reiniciar();
        await flujo.preparar(page, servidor);
        await page.evaluate((destino) => window.scrollTo(0, destino), y);
        await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(y);
        await esperarScrollAsentado(page);

        // Con el teclado, como una persona: el botón enfocado y Enter, con el servidor ya recuperado.
        await page.getByRole("button", { name: flujo.boton }).focus();
        servidor.reiniciar();
        await page.keyboard.press("Enter");
        await flujo.esperarResultado(page);
        // El código de la pantalla mueve el foco al contenedor cuando el nuevo estado ya está pintado.
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null), { timeout: 15000 })
          .toBe(flujo.grupo);
        await esperarScrollAsentado(page);

        const parada = await page.evaluate(medirParada);
        // Control: el anillo del contenedor se pinta (si no, no habría nada que tapar y la vuelta no probaría nada).
        expect(parada.anillo, `el contenedor «${flujo.grupo}» debe pintar su anillo de foco`).toBeGreaterThanOrEqual(2);
        if (parada.problemas.length > 0) tapados.push(`desplazada ${y} px de ${maximo}: ${describir(parada)}`);
      }
      expect(tapados, "contenedor con el anillo de foco tapado o fuera de la ventana").toEqual([]);
    });
  }
});
