import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";

// Solicitud de un paquete de páginas web (Combo Emprendedor y Plan Estándar), con Supabase SIMULADO: ninguna
// petición sale a la red. Todo lo que no es el origen de la app se intercepta (auth, REST, funciones) y el resto se
// aborta. Datos ficticios (dominios example.test). Sigue el patrón de dashboard-admin-only.spec.ts.
//
// Necesita que la app arranque con cualquier VITE_SUPABASE_URL/clave de prueba (no se contacta): se intercepta por
// ruta (/auth/v1, /rest/v1, /functions/v1), no por host. Solo prueba la INTERFAZ y la forma de la petición: la API
// real se protege con RLS, que esta prueba no toca.

const CLIENT = { id: "00000000-0000-4000-8000-000000000002", email: "cliente@example.test" };
const PASSWORD = "clave-de-prueba-1";

const INTENT_KEY = "ms.paquete-solicitado";

const COMBO = "Combo Emprendedor";
const STANDARD = "Plan Estándar";
const CONSENT_LINE =
  "Consentimiento para compartir datos con LAU Graphic: aceptado al enviar esta solicitud (texto de autorización v1; política de privacidad v1.2).";
const MESSAGE_HEADING_LINE = "Mensaje del cliente:";
const NOT_A_PAYMENT_LINE = "Esta solicitud no es un pago ni un contrato.";

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const fakeJwt = (sub: string) =>
  `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub, role: "authenticated", exp: 4102444800 })}.firma-de-prueba`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
  "access-control-expose-headers": "*",
};

interface Mock {
  /** Cuerpos de los POST a `rest/v1/tickets`, en orden. */
  readonly ticketPosts: Record<string, unknown>[];
  /** Con true, el siguiente POST a tickets responde 500 (la solicitud no se crea). */
  failTicketPosts: boolean;
  /** Retraso (ms) de la respuesta del POST a tickets: la ventana en la que el envío está en curso. */
  ticketPostDelayMs: number;
}

/** Simula Supabase para un cliente (`user_type: 2`). */
async function mockSupabase(context: BrowserContext, baseURL: string): Promise<Mock> {
  const origin = new URL(baseURL).origin;
  const mock: Mock = { ticketPosts: [], failTicketPosts: false, ticketPostDelayMs: 0 };

  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const json = (body: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });

    const authUser = {
      id: CLIENT.id,
      aud: "authenticated",
      role: "authenticated",
      email: CLIENT.email,
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    };

    if (url.pathname.endsWith("/auth/v1/token")) {
      return json({
        access_token: fakeJwt(CLIENT.id),
        refresh_token: "refresco-de-prueba",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: authUser,
      });
    }
    if (url.pathname.endsWith("/auth/v1/user")) return json(authUser);
    if (url.pathname.includes("/auth/v1/")) return json({});
    if (url.pathname.includes("/functions/v1/")) return json({});
    if (url.pathname.includes("/rest/v1/")) {
      if (url.pathname.endsWith("/rest/v1/profiles")) {
        return json({ user_type: 2 }, { "content-type": "application/vnd.pgrst.object+json" });
      }
      if (url.pathname.endsWith("/rest/v1/tickets") && request.method() === "POST") {
        mock.ticketPosts.push(request.postDataJSON() as Record<string, unknown>);
        if (mock.ticketPostDelayMs) await new Promise((resolve) => setTimeout(resolve, mock.ticketPostDelayMs));
        if (mock.failTicketPosts) {
          return route.fulfill({
            status: 500,
            headers: { ...CORS, "content-type": "application/json" },
            body: JSON.stringify({ code: "XX000", message: "falla simulada", details: null, hint: null }),
          });
        }
        return route.fulfill({ status: 201, headers: CORS, body: "" });
      }
      return json([], { "content-range": "*/0" });
    }
    return route.abort();
  });
  return mock;
}

const storedIntent = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), INTENT_KEY);

async function signIn(page: Page) {
  await page.getByLabel(/Email de trabajo/i).fill(CLIENT.email);
  await page.getByLabel(/^Contraseña$/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/solicitudes");
}

/** Inicia sesión desde /login sin paquete guardado: deja la sesión simulada en el almacenamiento del navegador. */
async function signedInClient(page: Page) {
  await page.goto("/login");
  await signIn(page);
  expect(await storedIntent(page)).toBeNull();
}

/** El recuadro del modo paquete y el formulario que lo contiene. */
const selectedBox = (page: Page) => page.getByRole("region", { name: "Paquete seleccionado" });
const packageForm = (page: Page) => page.getByRole("form", { name: "Solicitud de paquete", exact: true });
const consentBox = (page: Page) => page.getByRole("checkbox", { name: /Autorizo a MultiStack Systems a compartir con LAU Graphic/ });
/** El botón de enviar, también mientras envía (entonces dice «[ ENVIANDO... ]»). */
const submitButton = (page: Page) => page.getByRole("button", { name: /^\[ ENVIA(R SOLICITUD|NDO\.\.\.) \]$/ });
const pageHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "MIS SOLICITUDES" });
const SENT = (page: Page) => page.getByText("Solicitud enviada", { exact: true }).first();

test.describe("Solicitud de paquete de páginas web (Supabase simulado)", () => {
  let mock: Mock;

  test.beforeEach(async ({ context, baseURL }) => {
    mock = await mockSupabase(context, baseURL ?? "http://localhost:8080");
  });

  test("sin sesión: Combo -> login con aviso -> iniciar sesión -> modo paquete del Combo", async ({ page }) => {
    await page.goto("/paginas-web");

    const combo = page.getByRole("region", { name: COMBO });
    await expect(combo).toBeVisible();
    await combo.getByRole("link", { name: `Solicitar ${COMBO}` }).click();

    // ProtectedRoute manda a /login; la intención quedó guardada y el aviso nombra el paquete.
    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    expect(JSON.parse((await storedIntent(page)) ?? "null")).toMatchObject({ id: "combo-emprendedor" });
    const notice = page.getByRole("note").filter({ hasText: "Estás solicitando" });
    await expect(notice).toContainText(`Estás solicitando el ${COMBO}`);
    await expect(notice).toContainText("3950 lempiras");
    await expect(notice).toContainText("Inicia sesión para enviar tu solicitud.");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

    await signIn(page);

    // Modo paquete: recuadro con el Combo, casilla de consentimiento y nota de «no es un pago».
    await expect(packageForm(page)).toBeVisible();
    const box = selectedBox(page);
    await expect(box).toBeVisible();
    await expect(box).toContainText(COMBO);
    await expect(box).toContainText("3950 lempiras");
    await expect(box).toBeFocused();
    await expect(consentBox(page)).toBeVisible();
    await expect(page.getByText(/Esto es una solicitud, no un pago ni un contrato/)).toBeVisible();
    // Sigue guardada: la quita el envío o «Quitar paquete», no el login.
    expect(await storedIntent(page)).not.toBeNull();
  });

  test("sin sesión: el CTA del Plan Estándar guarda su propia intención y el login lo nombra", async ({ page }) => {
    await page.goto("/paginas-web");
    await page.getByRole("article", { name: new RegExp(STANDARD) }).getByRole("link", { name: `Solicitar ${STANDARD}` }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    expect(JSON.parse((await storedIntent(page)) ?? "null")).toMatchObject({ id: "estandar" });
    const notice = page.getByRole("note").filter({ hasText: "Estás solicitando" });
    await expect(notice).toContainText(`Estás solicitando el ${STANDARD}`);
    await expect(notice).toContainText("3500 lempiras");
    await expect(notice).not.toContainText(COMBO);

    await signIn(page);
    await expect(selectedBox(page)).toContainText(STANDARD);
    await expect(consentBox(page)).toHaveCount(0);
  });

  test("Combo: sin la casilla no se envía; con ella, el POST lleva la solicitud y ningún campo de pago", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/paginas-web");
    await page.getByRole("region", { name: COMBO }).getByRole("link", { name: `Solicitar ${COMBO}` }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/solicitudes");
    await expect(page).toHaveURL(/\/solicitudes\?paquete=combo-emprendedor$/);
    await expect(selectedBox(page)).toContainText(COMBO);

    const consent = consentBox(page);
    const hint = page.getByText("Marca la casilla para poder enviar tu solicitud.");
    await expect(consent).not.toBeChecked();
    await expect(hint).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();

    // El texto de la casilla termina en el propósito acotado; el título del formulario no lleva el «>» decorativo.
    await expect(consent).toHaveAccessibleName(/solo para diseñar el logo de mi Combo Emprendedor\.$/);
    await expect(packageForm(page)).toBeVisible();

    // El mensaje de ayuda está enlazado a la casilla, que además se anuncia como obligatoria.
    await expect(consent).toHaveAttribute("aria-required", "true");
    const hintId = await hint.getAttribute("id");
    expect(hintId).toBeTruthy();
    await expect(consent).toHaveAttribute("aria-describedby", hintId!);

    await page.getByLabel(/Nombre de tu negocio/).fill("Panadería Ejemplo");
    await page.getByLabel(/Cuéntanos de tu negocio/).fill("Necesito logo y página.\nLo quiero en azul.");
    // Enter dentro de un campo tampoco envía sin la casilla.
    await page.getByLabel(/Nombre de tu negocio/).press("Enter");
    await page.waitForTimeout(300);
    expect(mock.ticketPosts).toHaveLength(0);

    await consent.check();
    await expect(hint).toHaveCount(0);
    // Sin la ayuda en pantalla, la casilla ya no apunta a un id que no existe.
    await expect(consent).not.toHaveAttribute("aria-describedby", /.+/);
    await expect(submitButton(page)).toBeEnabled();
    await submitButton(page).click();

    await expect(SENT(page)).toBeVisible();
    // Tras el éxito el formulario se desmonta: el foco va al título de la pantalla, no a <body>.
    await expect(pageHeading(page)).toBeFocused();
    expect(mock.ticketPosts).toHaveLength(1);
    const body = mock.ticketPosts[0];
    expect(body).toMatchObject({
      type: "solicitud",
      client_email: CLIENT.email,
      title: `Solicitud: ${COMBO}`,
    });
    expect(body.description).toBe(
      [
        `Paquete solicitado: ${COMBO} (L 3,950)`,
        CONSENT_LINE,
        NOT_A_PAYMENT_LINE,
        "",
        "Negocio: Panadería Ejemplo",
        MESSAGE_HEADING_LINE,
        "> Necesito logo y página.",
        "> Lo quiero en azul.",
      ].join("\n"),
    );
    // Es una solicitud: ningún campo de cobro ni de contrato viaja en el ticket.
    const PAYMENT_FIELD = /pago|payment|price|precio|amount|monto|total|card|tarjeta|invoice|factura|contract|contrato/i;
    expect(Object.keys(body).filter((key) => PAYMENT_FIELD.test(key))).toEqual([]);

    // La intención se borra y la URL queda limpia.
    expect(await storedIntent(page)).toBeNull();
    expect(new URL(page.url()).search).not.toContain("paquete");
    await expect(packageForm(page)).toHaveCount(0);
  });

  test("si el envío falla, el paquete sigue elegido y se puede reintentar", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/paginas-web");
    await page.getByRole("region", { name: COMBO }).getByRole("link", { name: `Solicitar ${COMBO}` }).click();
    await expect(page).toHaveURL(/\/solicitudes\?paquete=combo-emprendedor$/);
    await expect(selectedBox(page)).toContainText(COMBO);

    mock.failTicketPosts = true;
    mock.ticketPostDelayMs = 600;
    await consentBox(page).check();
    await submitButton(page).focus();
    await page.keyboard.press("Enter");

    // Mientras envía, el botón sigue siendo el elemento con el foco: aria-disabled y no disabled; otro Enter no repite el envío.
    const sending = page.getByRole("button", { name: "[ ENVIANDO... ]" });
    await expect(sending).toHaveAttribute("aria-disabled", "true");
    // (Playwright cuenta aria-disabled como deshabilitado: se mira la propiedad `disabled` del DOM.)
    await expect(sending).toHaveJSProperty("disabled", false);
    await expect(sending).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("No se pudo enviar tu solicitud", { exact: true })).toBeVisible();

    // Tras el fallo el foco sigue en el botón (no cae en <body>) y ya no está aria-disabled.
    const again = page.getByRole("button", { name: "[ ENVIAR SOLICITUD ]" });
    await expect(again).toBeFocused();
    await expect(again).not.toHaveAttribute("aria-disabled", /.+/);
    expect(mock.ticketPosts).toHaveLength(1);
    await expect(selectedBox(page)).toContainText(COMBO);
    expect(await storedIntent(page)).not.toBeNull();
    await expect(page).toHaveURL(/paquete=combo-emprendedor/);

    mock.failTicketPosts = false;
    mock.ticketPostDelayMs = 0;
    await submitButton(page).click();
    await expect(SENT(page)).toBeVisible();
    await expect(pageHeading(page)).toBeFocused();
    expect(mock.ticketPosts).toHaveLength(2);
    expect(await storedIntent(page)).toBeNull();
  });

  test("con sesión: el CTA del Plan Estándar abre el modo paquete del Estándar, sin consentimiento", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/paginas-web");
    await page.getByRole("article", { name: new RegExp(STANDARD) }).getByRole("link", { name: `Solicitar ${STANDARD}` }).click();

    await expect(page).toHaveURL(/\/solicitudes\?paquete=estandar$/);
    const box = selectedBox(page);
    await expect(box).toContainText(STANDARD);
    await expect(box).toContainText("3500 lempiras");
    await expect(consentBox(page)).toHaveCount(0);
    await expect(page.getByText(/LAU Graphic/)).toHaveCount(0);
    await expect(submitButton(page)).toBeEnabled();

    await submitButton(page).click();
    await expect(SENT(page)).toBeVisible();
    await expect(pageHeading(page)).toBeFocused();
    expect(mock.ticketPosts).toHaveLength(1);
    expect(mock.ticketPosts[0]).toMatchObject({ type: "solicitud", title: `Solicitud: ${STANDARD}` });
    expect(mock.ticketPosts[0].description).toBe(
      [`Paquete solicitado: ${STANDARD} (L 3,500)`, NOT_A_PAYMENT_LINE].join("\n"),
    );
    expect(String(mock.ticketPosts[0].description)).not.toContain("LAU Graphic");
    expect(await storedIntent(page)).toBeNull();
  });

  test("«Quitar paquete» vuelve al formulario normal y borra la intención", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/paginas-web");
    await page.getByRole("region", { name: COMBO }).getByRole("link", { name: `Solicitar ${COMBO}` }).click();
    await expect(page).toHaveURL(/paquete=combo-emprendedor/);
    await expect(selectedBox(page)).toBeVisible();

    await page.getByRole("button", { name: "Quitar paquete" }).click();

    await expect(packageForm(page)).toHaveCount(0);
    // El botón que tenía el foco desaparece: el foco pasa al título de la pantalla, no a <body>.
    await expect(pageHeading(page)).toBeFocused();
    await expect(page.getByText("> Nueva solicitud de desarrollo")).toBeVisible();
    await expect(page.getByText("Tipo de servicio")).toBeVisible();
    expect(await storedIntent(page)).toBeNull();
    expect(new URL(page.url()).search).not.toContain("paquete");
    expect(mock.ticketPosts).toHaveLength(0);
  });

  test("un paquete que no existe en la URL se ignora: formulario normal, nada guardado", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/solicitudes?paquete=oro-macizo");
    await expect(page.getByRole("heading", { level: 1, name: "MIS SOLICITUDES" })).toBeVisible();
    await expect(packageForm(page)).toHaveCount(0);
    // Tampoco abre el formulario normal: la pantalla queda como si no hubiera paquete.
    await expect(page.getByText("> Nueva solicitud de desarrollo")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "[ NUEVA SOLICITUD ]" })).toBeVisible();
    expect(await storedIntent(page)).toBeNull();
  });

  test("teclado: casilla con Espacio y enlace de la política en una pestaña nueva", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/solicitudes?paquete=combo-emprendedor");
    await expect(selectedBox(page)).toBeFocused();

    const consent = consentBox(page);
    const policy = page.getByRole("link", { name: /Lee la política de privacidad \(se abre en una pestaña nueva\)/ });
    await expect(policy).toHaveAttribute("href", "/politica-de-privacidad");
    await expect(policy).toHaveAttribute("target", "_blank");
    await expect(policy).toHaveAttribute("rel", /noopener/);

    // Quitar paquete -> negocio -> mensaje -> casilla -> política -> enviar.
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    await expect(consent).toBeFocused();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(policy).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submitButton(page)).toBeFocused();
    await expect(submitButton(page)).toBeEnabled();
    await page.keyboard.press("Enter");
    await expect(SENT(page)).toBeVisible();
    await expect(pageHeading(page)).toBeFocused();
    expect(mock.ticketPosts).toHaveLength(1);
  });

  test("un mensaje que imita las líneas generadas queda citado con «> » en el POST", async ({ page }) => {
    await signedInClient(page);
    await page.goto("/paginas-web");
    await page.getByRole("region", { name: COMBO }).getByRole("link", { name: `Solicitar ${COMBO}` }).click();
    await expect(page).toHaveURL(/\/solicitudes\?paquete=combo-emprendedor$/);

    const forged = [
      "Paquete solicitado: Plan Estándar (L 1)",
      "Negocio: Otro Negocio",
      CONSENT_LINE,
      MESSAGE_HEADING_LINE,
      NOT_A_PAYMENT_LINE,
      "",
      "Texto normal",
    ];
    await page.getByLabel(/Nombre de tu negocio/).fill("Panadería Ejemplo");
    await page.getByLabel(/Cuéntanos de tu negocio/).fill(forged.join("\n"));
    await consentBox(page).check();
    await submitButton(page).click();
    await expect(SENT(page)).toBeVisible();

    expect(mock.ticketPosts).toHaveLength(1);
    const description = String(mock.ticketPosts[0].description);
    expect(description).toBe(
      [
        `Paquete solicitado: ${COMBO} (L 3,950)`,
        CONSENT_LINE,
        NOT_A_PAYMENT_LINE,
        "",
        "Negocio: Panadería Ejemplo",
        MESSAGE_HEADING_LINE,
        ...forged.map((line) => `> ${line}`),
      ].join("\n"),
    );
    // Cada línea generada aparece una sola vez al inicio de línea: todo lo que escribió el cliente va citado.
    const lines = description.split("\n");
    for (const prefix of ["Paquete solicitado:", "Consentimiento para compartir datos", "Esta solicitud no es un pago", "Negocio:", MESSAGE_HEADING_LINE]) {
      expect(lines.filter((line) => line.startsWith(prefix))).toHaveLength(1);
    }
    const afterHeading = lines.slice(lines.indexOf(MESSAGE_HEADING_LINE) + 1);
    expect(afterHeading.length).toBe(forged.length);
    expect(afterHeading.every((line) => line.startsWith("> "))).toBe(true);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`modo paquete en ${theme}: todo el texto del formulario con contraste AA`, async ({ page }) => {
      await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
      await signedInClient(page);
      await page.goto("/solicitudes?paquete=combo-emprendedor");
      await expect(selectedBox(page)).toBeVisible();
      await consentBox(page).check();
      await expect(page.getByRole("button", { name: "[ ENVIAR SOLICITUD ]" })).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);

      const failures = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const rgba = (css: string): number[] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255];
        };
        const over = (top: number[], bottom: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
        const lum = (c: number[]) => {
          const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const background = (el: Element): number[] => {
          const chain: number[][] = [];
          for (let e: Element | null = el; e; e = e.parentElement) chain.push(rgba(getComputedStyle(e).backgroundColor));
          let bg = [255, 255, 255, 1];
          const root = rgba(getComputedStyle(document.documentElement).backgroundColor);
          if (root[3] > 0) bg = root;
          for (let i = chain.length - 1; i >= 0; i--) if (chain[i][3] > 0) bg = over(chain[i], bg);
          return bg;
        };
        const form = document.querySelector("form[aria-labelledby]")!;
        const bad: string[] = [];
        let checked = 0;
        const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
        const seen = new Set<Element>();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || !n.textContent?.trim() || seen.has(el) || el.closest(".sr-only,[aria-hidden=true]")) continue;
          seen.add(el);
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const bg = background(el);
          const fg = over(rgba(cs.color), bg);
          const l1 = lum(fg);
          const l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.66 && (parseInt(cs.fontWeight, 10) || 400) >= 700);
          checked++;
          if (ratio < (large ? 3 : 4.5)) bad.push(`${n.textContent.trim().slice(0, 40)} (${ratio.toFixed(2)}:1)`);
        }
        return checked >= 10 ? bad : [`solo se midieron ${checked} textos`];
      });
      expect(failures).toEqual([]);
    });
  }

  test("registro: con una intención guardada, /signup muestra el aviso del paquete", async ({ page }) => {
    await page.goto("/paginas-web");
    await page.getByRole("region", { name: COMBO }).getByRole("link", { name: `Solicitar ${COMBO}` }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    expect(await storedIntent(page)).not.toBeNull();

    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
    const notice = page.getByRole("note").filter({ hasText: "Estás solicitando" });
    await expect(notice).toContainText(`Estás solicitando el ${COMBO}`);
    await expect(notice).toContainText("3950 lempiras");
    await expect(notice).toContainText("Crea tu cuenta y confirma tu correo; después podrás enviar tu solicitud.");
    // Mirar el aviso no gasta la intención: la usa /solicitudes después de iniciar sesión.
    expect(await storedIntent(page)).not.toBeNull();
  });

  test("sin intención guardada no hay aviso en /login ni en /signup", async ({ page }) => {
    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: path === "/login" ? "Iniciar sesión" : "Crear cuenta" })).toBeVisible();
      await expect(page.getByText("Estás solicitando")).toHaveCount(0);
    }
  });
});
