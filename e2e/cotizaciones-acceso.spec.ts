import { test, expect, type Page } from "@playwright/test";
import {
  PANEL_MARKS,
  USERS,
  fromPanel,
  mockSupabase,
  panelSeen,
  resetPanelSeen,
  sampleDom,
  signIn,
  watchForAdminContent,
  type ContentMark,
  type Mock,
  type RestHandler,
  type Role,
} from "./support/supabase-simulado";

// Acceso al módulo de Cotizaciones (F1, solo administrador), con Supabase SIMULADO: ninguna petición sale a la red
// (ver `e2e/support/supabase-simulado.ts`). Datos 100 % sintéticos. Solo prueba la INTERFAZ: la protección real de los
// datos es RLS, que esta prueba no toca.
//
// El simulacro sirve las cotizaciones sintéticas a CUALQUIER rol que las pida (la base real no las daría a un
// no administrador): así, si una pantalla las pidiera cuando no debe, se verían en el DOM y no solo en el contador.

interface FilaSimulada {
  /** Para entregar solo las columnas que pide `select`. */
  [columna: string]: string | number | null;
  id: string;
  referencia_interna: string;
  estado: string;
  prospecto_nombre: string;
  prospecto_contacto: string;
  prospecto_email: string;
  prospecto_telefono: string;
  creado_por: string;
  creado_at: string;
  actualizado_por: string | null;
  actualizado_at: string;
  row_version: number;
}

/** Con el formato de `src/lib/cotizaciones.ts` (PostgREST) y de la más reciente a la más antigua. */
const COTIZACIONES: readonly FilaSimulada[] = [
  {
    id: "c2000000-0000-4000-8000-000000000003",
    referencia_interna: "BOR-3",
    estado: "emitida",
    prospecto_nombre: "Empresa Sintetica Gamma",
    prospecto_contacto: "Contacto Sintetico Gamma",
    prospecto_email: "gamma@example.test",
    prospecto_telefono: "+000 555 0103",
    creado_por: USERS[0].id,
    creado_at: "2026-11-09T21:30:00.123456+00:00",
    actualizado_por: null,
    actualizado_at: "2026-11-10T14:05:00+00:00",
    row_version: 2,
  },
  {
    id: "c2000000-0000-4000-8000-000000000002",
    referencia_interna: "BOR-2",
    estado: "borrador",
    prospecto_nombre: "Empresa Sintetica Beta",
    prospecto_contacto: "Contacto Sintetico Beta",
    prospecto_email: "beta@example.test",
    prospecto_telefono: "+000 555 0102",
    creado_por: USERS[0].id,
    creado_at: "2026-11-08T15:00:00+00:00",
    actualizado_por: USERS[0].id,
    actualizado_at: "2026-11-08T15:00:00+00:00",
    row_version: 1,
  },
  {
    id: "c2000000-0000-4000-8000-000000000001",
    referencia_interna: "BOR-1",
    estado: "borrador",
    prospecto_nombre: "Empresa Sintetica Alfa",
    prospecto_contacto: "Contacto Sintetico Alfa",
    prospecto_email: "alfa@example.test",
    prospecto_telefono: "+000 555 0101",
    creado_por: USERS[0].id,
    creado_at: "2026-11-07T10:15:30.5+00:00",
    actualizado_por: null,
    actualizado_at: "2026-11-07T10:15:30.5+00:00",
    row_version: 1,
  },
];

const [DETALLE_SIMULADO] = COTIZACIONES;
const UUID_QUE_NO_EXISTE = "c2000000-0000-4000-8000-0000000000ff";

const LISTA = "/dashboard/cotizaciones";
const CATALOGO = "/dashboard/cotizaciones/catalogo";
const DETALLE = `/dashboard/cotizaciones/${DETALLE_SIMULADO.id}`;
const RUTAS = [LISTA, CATALOGO, DETALLE] as const;

/**
 * Se comporta como PostgREST con lo que pide la capa de datos: el detalle filtra por `id=eq.<uuid>` y devuelve un
 * arreglo de 0 o 1 fila; el listado respeta `offset`/`limit` y solo entrega las columnas de `select`.
 */
const servirCotizaciones: RestHandler = ({ table, method, url }) => {
  if (table !== "cotizaciones" || method !== "GET") return undefined;
  const id = url.searchParams.get("id")?.replace(/^eq\./, "");
  if (id !== undefined) return { body: COTIZACIONES.filter((fila) => fila.id === id) };
  const desde = Number(url.searchParams.get("offset") ?? "0");
  const limite = Number(url.searchParams.get("limit") ?? COTIZACIONES.length);
  const columnas = (url.searchParams.get("select") ?? "").split(",").map((columna) => columna.trim());
  const filas = COTIZACIONES.slice(desde, desde + limite).map((fila) =>
    Object.fromEntries(columnas.map((columna) => [columna, fila[columna]])),
  );
  return { body: filas };
};

/** Consultas a las tablas del módulo (`cotizaciones`, `cotizacion_eventos`), desde cualquier pantalla. */
const consultasDeCotizaciones = (mock: Mock) =>
  mock.dataQueries.map((q) => q.query).filter((q) => q.split(" ")[1]?.startsWith("cotizacion"));

/** El nombre, el contacto, el correo y el teléfono del prospecto, que el detalle pinta como texto plano. */
const DATOS_DEL_PROSPECTO = [
  DETALLE_SIMULADO.prospecto_nombre,
  DETALLE_SIMULADO.prospecto_contacto,
  DETALLE_SIMULADO.prospecto_email,
  DETALLE_SIMULADO.prospecto_telefono,
] as const;
/** Cada dato del prospecto (el listado y el detalle los envuelven en `<bdi>`): la marca salta si llega a pintarse. */
const MARCAS_DE_DATOS_DEL_PROSPECTO: readonly ContentMark[] = DATOS_DEL_PROSPECTO.map((valor) => ({
  name: `dato del prospecto ${valor}`,
  selector: "bdi",
  text: valor,
}));

/** Marcas que solo existen con una pantalla de Cotizaciones montada, además de las del panel. */
const MARCAS_DE_COTIZACIONES: readonly ContentMark[] = [
  { name: "entrada de menú Cotizaciones", selector: 'a[href^="/dashboard/cotizaciones"]' },
  { name: "listado de cotizaciones", selector: '[aria-label="Listado de cotizaciones"]' },
  { name: "detalle de la cotización", selector: '[aria-label="Detalle de la cotización"]' },
  { name: "aviso del catálogo", selector: "h2", text: "El catálogo se habilita en la siguiente fase" },
  { name: "cotización no encontrada", selector: "h2", text: "Cotización no encontrada" },
  ...COTIZACIONES.map((fila) => ({ name: `referencia ${fila.referencia_interna}`, selector: "a", text: fila.referencia_interna })),
  ...MARCAS_DE_DATOS_DEL_PROSPECTO,
];

/** «Cotizaciones» es la única entrada de la barra lateral que es la página actual, en las tres pantallas y en `/xyz`. */
async function esperarEntradaActual(page: Page) {
  const barra = page.locator("#admin-sidebar");
  const entrada = barra.getByRole("link", { name: "Cotizaciones", exact: true });
  await expect(entrada).toHaveAttribute("href", LISTA);
  await expect(entrada).toHaveAttribute("aria-current", "page");
  await expect(barra.locator('a[aria-current="page"]')).toHaveCount(1);
}

const titulo = (page: Page, nivel: 1 | 2, nombre: string) =>
  page.getByRole("heading", { level: nivel, name: nombre, exact: true });

/**
 * Marcas distintas que el observador vio en el documento actual. Las pruebas del administrador comprueban aquí que
 * cada marca SÍ aparece cuando la pantalla existe: así las pruebas de los demás roles, que afirman lo contrario, no
 * pasan en vacío por un selector que no coincide con nada.
 */
const marcasVistas = async (page: Page) => [...new Set(await panelSeen(page))];

test.describe("Quotations module is administrator-only (UI)", () => {
  test("administrator (0) opens the list directly: simulated rows and the menu entry is the current page", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
    await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
    await signIn(page, 0);
    await page.goto(LISTA);

    await expect(titulo(page, 1, "Cotizaciones")).toBeVisible({ timeout: 15000 });
    expect(new URL(page.url()).pathname).toBe(LISTA);
    const tabla = page.getByRole("table");
    await expect(tabla.getByRole("row")).toHaveCount(COTIZACIONES.length + 1);
    for (const fila of COTIZACIONES) {
      await expect(tabla.getByRole("link", { name: fila.referencia_interna, exact: true })).toHaveAttribute(
        "href",
        `/dashboard/cotizaciones/${fila.id}`,
      );
      await expect(tabla.getByText(fila.prospecto_nombre, { exact: true })).toBeVisible();
    }
    await expect(tabla.getByText("Emitida", { exact: true })).toBeVisible();
    await expect(tabla.getByText("Borrador", { exact: true })).toHaveCount(2);
    await esperarEntradaActual(page);
    expect(consultasDeCotizaciones(mock)).toContain("GET cotizaciones");
    expect(await marcasVistas(page)).toEqual(
      expect.arrayContaining([
        "#admin-sidebar",
        "#contenido",
        "entrada de menú Cotizaciones",
        "listado de cotizaciones",
        ...COTIZACIONES.map((fila) => `referencia ${fila.referencia_interna}`),
      ]),
    );
  });

  test("administrator (0) opens the catalog directly: the catalog, not the detail, and no quotation is requested", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
    await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
    await signIn(page, 0);
    await page.goto(CATALOGO);

    await expect(titulo(page, 2, "El catálogo se habilita en la siguiente fase")).toBeVisible({ timeout: 15000 });
    await expect(titulo(page, 1, "Catálogo")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(CATALOGO);
    // «catalogo» no se confunde con el `:id` del detalle.
    await expect(page.getByRole("group", { name: "Detalle de la cotización" })).toHaveCount(0);
    await expect(titulo(page, 2, "Cotización no encontrada")).toHaveCount(0);
    await esperarEntradaActual(page);
    await page.waitForTimeout(500); // por si una consulta saliera tarde
    expect(consultasDeCotizaciones(mock)).toEqual([]);
    // En ningún instante se montó el detalle ni el aviso de «no encontrada» (no solo al final).
    const vistas = await marcasVistas(page);
    expect(vistas).toEqual(expect.arrayContaining(["aviso del catálogo", "entrada de menú Cotizaciones"]));
    expect(vistas).not.toContain("detalle de la cotización");
    expect(vistas).not.toContain("cotización no encontrada");
  });

  test("administrator (0) opens the detail of an existing UUID directly: the prospect's data as plain text", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
    await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
    await signIn(page, 0);
    await page.goto(DETALLE);

    await expect(titulo(page, 1, `Cotización ${DETALLE_SIMULADO.referencia_interna}`)).toBeVisible({ timeout: 15000 });
    expect(new URL(page.url()).pathname).toBe(DETALLE);
    const detalle = page.getByRole("group", { name: "Detalle de la cotización" });
    for (const dato of DATOS_DEL_PROSPECTO) await expect(detalle.getByText(dato, { exact: true })).toBeVisible();
    await expect(detalle.getByText("Emitida", { exact: true })).toBeVisible();
    // Sin enlaces de correo ni de teléfono: todo es texto plano.
    await expect(detalle.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
    await esperarEntradaActual(page);
    expect(consultasDeCotizaciones(mock)).toContain("GET cotizaciones");
    await expect(titulo(page, 2, "Cotización no encontrada")).toHaveCount(0);
    const vistas = await marcasVistas(page);
    expect(vistas).toEqual(expect.arrayContaining(["detalle de la cotización", ...MARCAS_DE_DATOS_DEL_PROSPECTO.map((marca) => marca.name)]));
    expect(vistas).not.toContain("cotización no encontrada");
  });

  test("administrator (0) opens /dashboard/cotizaciones/xyz: not found, and the quotations table is never queried", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
    await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
    await signIn(page, 0);
    await page.goto("/dashboard/cotizaciones/xyz");

    await expect(titulo(page, 2, "Cotización no encontrada")).toBeVisible({ timeout: 15000 });
    await esperarEntradaActual(page);
    await page.waitForTimeout(500); // por si una consulta saliera tarde
    expect(consultasDeCotizaciones(mock)).toEqual([]);
    expect(await marcasVistas(page)).toContain("cotización no encontrada");
  });

  test("administrator (0) opens a well-formed UUID that does not exist: the same notice, after asking once", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
    await signIn(page, 0);
    await page.goto(`/dashboard/cotizaciones/${UUID_QUE_NO_EXISTE}`);

    await expect(titulo(page, 2, "Cotización no encontrada")).toBeVisible({ timeout: 15000 });
    expect(consultasDeCotizaciones(mock)).toContain("GET cotizaciones");
  });

  // Quien no es administrador no entra a ninguna de las tres pantallas y termina en su destino habitual (el mismo que
  // en `dashboard-admin-only.spec.ts`); sin sesión, en /login. Nunca ve el panel ni datos de cotizaciones, y desde las
  // pantallas del panel no sale ninguna consulta de datos (ni a las tablas del módulo desde ningún sitio).
  const DENEGADOS: ReadonlyArray<readonly [string, Role | null, string]> = [
    ["role 1 (collaborator)", 1, "/"],
    ["role 2 (client)", 2, "/solicitudes"],
    ["no session", null, "/login"],
  ];
  for (const path of RUTAS) {
    for (const [quien, role, destino] of DENEGADOS) {
      test(`${quien} typing ${path} ends on ${destino} and never sees the panel or quotations data`, async ({ page, context, baseURL }) => {
        const mock = await mockSupabase(context, baseURL!, role ?? 0, 0, undefined, servirCotizaciones);
        await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
        if (role !== null) {
          await signIn(page, role);
          mock.dataQueries.length = 0;
        }

        await page.goto(path);
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destino);
        await page.waitForTimeout(500); // por si algo se montara o se pidiera tarde

        await expect(page.locator("#admin-sidebar, #contenido")).toHaveCount(0);
        expect(await panelSeen(page)).toEqual([]);
        expect(fromPanel(mock)).toEqual([]);
        expect(consultasDeCotizaciones(mock)).toEqual([]);
      });
    }
  }

  test("collaborator (1) never sees the «Cotizaciones» entry: not where he lands and not behind /dashboard", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 1, 0, undefined, servirCotizaciones);
    await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
    await signIn(page, 1);

    const sinEntrada = async () => {
      await expect(page.getByRole("link", { name: "Cotizaciones", exact: true })).toHaveCount(0);
      await expect(page.locator('a[href^="/dashboard/cotizaciones"]')).toHaveCount(0);
    };
    await sinEntrada();

    await page.goto("/dashboard");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/");
    await sinEntrada();
    await page.waitForTimeout(500);

    expect(await panelSeen(page)).toEqual([]);
    expect(consultasDeCotizaciones(mock)).toEqual([]);
  });

  // El hueco real: sesión nueva en la misma pestaña, con el rol aún por resolver (la respuesta del perfil tarda).
  for (const role of [0, 1, 2] as const) {
    test(`role ${role} navigating to ${LISTA} while the role is still resolving`, async ({ page, context, baseURL }) => {
      const mock = await mockSupabase(context, baseURL!, role, 2500, undefined, servirCotizaciones);
      await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);

      await page.goto("/login");
      await page.getByLabel(/Email de trabajo/i).fill(USERS[role].email);
      await page.getByLabel(/^Contraseña$/i).fill("clave-de-prueba-1");
      const tokenResponse = page.waitForResponse((r) => r.url().includes("/auth/v1/token"));
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
      await tokenResponse;

      // Navegación dentro de la SPA (como un enlace o el botón «atrás»), con la sesión ya guardada pero el rol sin llegar.
      await page.evaluate((target) => {
        window.history.pushState({}, "", target);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, LISTA);
      expect(new URL(page.url()).pathname).toBe(LISTA);

      // Captura del DOM durante la resolución: solo el cargador de marca, nada del panel ni de cotizaciones.
      const muestras = await sampleDom(page, [...PANEL_MARKS, ...MARCAS_DE_COTIZACIONES], 1500);
      expect(muestras.flatMap((muestra) => muestra.marks)).toEqual([]);
      expect(muestras.some((muestra) => muestra.logo)).toBe(true);
      expect(fromPanel(mock)).toEqual([]);
      expect(consultasDeCotizaciones(mock)).toEqual([]);

      // El rol llega: el administrador ve la lista; los demás terminan en su destino sin haber visto nada ni pedido nada.
      if (role === 0) {
        await expect(page.getByRole("link", { name: DETALLE_SIMULADO.referencia_interna, exact: true })).toBeVisible({ timeout: 15000 });
        expect(new URL(page.url()).pathname).toBe(LISTA);
        expect(consultasDeCotizaciones(mock)).toContain("GET cotizaciones");
        // Control: las marcas de la lista sí saltan cuando la lista existe (los otros roles afirman lo contrario).
        expect(await marcasVistas(page)).toEqual(expect.arrayContaining(["listado de cotizaciones", "#admin-sidebar"]));
      } else {
        const destino = role === 1 ? "/" : "/solicitudes";
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destino);
        await page.waitForTimeout(500);
        expect(await panelSeen(page)).toEqual([]);
        expect(consultasDeCotizaciones(mock)).toEqual([]);
      }
    });
  }

  test("closing the session from the detail leaves no data of the prospect on screen, in storage or after going back", async ({ page, context, baseURL }) => {
    const mock = await mockSupabase(context, baseURL!, 0, 0, undefined, servirCotizaciones);
    await watchForAdminContent(page, MARCAS_DE_COTIZACIONES);
    await signIn(page, 0);
    await page.goto(DETALLE);

    // Control: con la sesión abierta los datos sí están a la vista y el observador los ve.
    const detalle = page.getByRole("group", { name: "Detalle de la cotización" });
    for (const dato of DATOS_DEL_PROSPECTO) await expect(detalle.getByText(dato, { exact: true })).toBeVisible({ timeout: 15000 });
    expect(await marcasVistas(page)).toEqual(expect.arrayContaining(MARCAS_DE_DATOS_DEL_PROSPECTO.map((marca) => marca.name)));

    await page.getByRole("button", { name: /^Cuenta:/ }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).not.toMatch(/^\/dashboard/);
    await page.waitForTimeout(500);

    const sinRastro = async () => {
      const documento = await page.content();
      const almacenamiento = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
      for (const dato of [...DATOS_DEL_PROSPECTO, DETALLE_SIMULADO.referencia_interna]) {
        expect(documento, `el documento no debe contener «${dato}»`).not.toContain(dato);
        expect(almacenamiento, `el almacenamiento no debe contener «${dato}»`).not.toContain(dato);
      }
    };
    await sinRastro();

    // Volver al detalle dentro de la SPA (botón «atrás», enlace guardado): sin sesión va a /login, sin datos y sin consultas.
    await resetPanelSeen(page);
    const consultasAntes = consultasDeCotizaciones(mock).length;
    await page.evaluate((target) => {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, DETALLE);
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/login");
    await page.waitForTimeout(500);

    await sinRastro();
    expect(await panelSeen(page)).toEqual([]);
    expect(consultasDeCotizaciones(mock)).toHaveLength(consultasAntes);
  });
});
