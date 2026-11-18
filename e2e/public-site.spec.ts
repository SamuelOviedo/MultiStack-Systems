import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// Sitio público rediseñado: home (/), /planes, /servicios y /contacto. Todo lo que no es el origen de la app se intercepta
// (la hoja de Google Fonts de index.html y, en las rutas de Ads, el script de la etiqueta) y se responde vacío: ninguna
// petición sale a la red y no hay errores de consola por recursos abortados. La app no llama a Supabase en estas vistas
// sin sesión, así que basta una URL de prueba cualquiera en VITE_SUPABASE_URL.
//
// La prueba de la etiqueta de Ads necesita que el servidor de la app arranque con un VITE_GADS_ID falso de la forma
// AW-<dígitos> (por ejemplo `VITE_GADS_ID=AW-1000000000 npm run test:e2e`); sin esa variable se omite.

const INTENT_KEY = "ms.paquete-solicitado";
const ADS_TAG = /googletagmanager\.com\/gtag\/js/;
const ADS_ID = process.env.VITE_GADS_ID ?? "";

const VIEWS = [
  { path: "/", name: "home", h1: /Páginas web para negocios en Honduras/ },
  { path: "/planes", name: "planes", h1: /Planes claros, en lempiras/ },
  { path: "/servicios", name: "servicios", h1: /Tecnología que trabaja para tu negocio/ },
  { path: "/contacto", name: "contacto", h1: /Cuéntanos qué necesitas/ },
] as const;

const SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
] as const;

/** Intercepta todo lo que no es de la app: responde vacío con un tipo válido y guarda las URL pedidas. */
async function isolate(context: BrowserContext, baseURL: string): Promise<string[]> {
  const origin = new URL(baseURL).origin;
  const external: string[] = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    external.push(url.href);
    switch (request.resourceType()) {
      case "script":
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      case "stylesheet":
        return route.fulfill({ status: 200, contentType: "text/css", body: "" });
      default:
        return route.fulfill({ status: 204, body: "" });
    }
  });
  return external;
}

/** Errores de consola y excepciones de la página (las advertencias de React Router y de WebGL no cuentan). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const storedIntent = (page: Page) =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { id: string }).id : null;
  }, INTENT_KEY);

test.beforeEach(async ({ context, baseURL }) => {
  await isolate(context, baseURL ?? "http://localhost:8080");
});

test.describe("Cada vista, en cinco anchos", () => {
  for (const view of VIEWS) {
    for (const size of SIZES) {
      test(`${view.name} a ${size.width} px: sin scroll horizontal, sin errores de consola y con el H1 visible`, async ({ page }) => {
        const errors = collectErrors(page);
        await page.setViewportSize(size);
        await page.goto(view.path);

        await expect(h1(page)).toHaveCount(1);
        await expect(h1(page)).toBeVisible();
        await expect(h1(page)).toHaveAccessibleName(view.h1);
        await page.evaluate(() => document.fonts.ready);

        const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await expect.poll(overflow, { message: "scroll horizontal al cargar" }).toBeLessThanOrEqual(0);

        // Se recorre la página hasta el final: las entradas por scroll y las secciones diferidas no deben ensancharla.
        await page.evaluate(async () => {
          for (let y = 0; y <= document.documentElement.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        });
        await expect.poll(overflow, { message: "scroll horizontal al recorrer la página" }).toBeLessThanOrEqual(0);

        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe("Cabecera y navegación", () => {
  for (const view of VIEWS) {
    test(`en ${view.name} solo su enlace de la navegación lleva aria-current=page`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(view.path);
      const nav = page.getByRole("navigation", { name: "Principal" });
      await expect(nav.locator("a[aria-current=page]")).toHaveCount(1);
      await expect(nav.locator("a[aria-current=page]")).toHaveAttribute("href", view.path);
    });
  }

  test("menú móvil: abre, Escape lo cierra y devuelve el foco, y al elegir una vista navega y se cierra", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Abrir menú" });
    const panel = page.getByRole("navigation", { name: "Menú principal" });

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel.getByRole("link", { name: "Planes" })).toBeVisible();
    // El enlace de la vista actual está marcado también en el menú.
    await expect(panel.locator("a[aria-current=page]")).toHaveText("Inicio");

    await panel.getByRole("link", { name: "Planes" }).focus();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await panel.getByRole("link", { name: "Servicios" }).click();
    await expect(page).toHaveURL(/\/servicios$/);
    await expect(h1(page)).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
  });

  test("el enlace de salto lleva el foco al contenido sin cambiar la URL", async ({ page }) => {
    await page.goto("/planes?gclid=abc");
    await expect(h1(page)).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/planes?gclid=abc");
  });

  test("los enlaces internos de la cabecera conservan gclid y utm hacia otra vista y dejan atrás el resto", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?gclid=abc123&utm_source=google&utm_campaign=web&foo=1");
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Contacto" }).click();
    await expect(page).toHaveURL(/\/contacto\?gclid=abc123&utm_source=google&utm_campaign=web$/);
    await expect(h1(page)).toBeVisible();
  });
});

test.describe("Flujos del sitio", () => {
  test("«Ver planes» del hero lleva a /planes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "Ver planes" }).click();
    await expect(page).toHaveURL(/\/planes$/);
    await expect(h1(page)).toHaveAccessibleName(/Planes claros/);
  });

  test("«Ver planes» conserva la query del anuncio", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?gclid=abc123");
    await page.getByRole("link", { name: "Ver planes" }).click();
    await expect(page).toHaveURL(/\/planes\?gclid=abc123$/);
  });

  for (const origin of ["/planes", "/"] as const) {
    test(`«Solicitar Intermedio» en ${origin === "/" ? "la home" : origin} guarda la intención y, sin sesión, lleva a /login`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(origin);
      expect(await storedIntent(page)).toBeNull();

      const request = page.getByRole("link", { name: "Solicitar Intermedio" });
      await expect(request).toHaveAttribute("href", "/solicitudes?paquete=intermedio");
      await request.click();

      await expect(page).toHaveURL(/\/login/);
      expect(await storedIntent(page)).toBe("intermedio");
    });
  }

  test("/#contacto redirige a /contacto (y /?gclid=x#contacto conserva el gclid)", async ({ page }) => {
    await page.goto("/#contacto");
    await expect(page).toHaveURL(/\/contacto$/);
    await expect(h1(page)).toHaveAccessibleName(/Cuéntanos qué necesitas/);

    await page.goto("/?gclid=x#contacto");
    await expect(page).toHaveURL(/\/contacto\?gclid=x$/);
    await expect(h1(page)).toBeVisible();
  });

  test("/#planes y /#servicios también llevan a su vista", async ({ page }) => {
    await page.goto("/#planes");
    await expect(page).toHaveURL(/\/planes$/);
    await page.goto("/#servicios");
    await expect(page).toHaveURL(/\/servicios$/);
  });

  test("/contacto trae nuestro formulario (no el de WhatsApp): valida, y no promete abrir WhatsApp", async ({ page }) => {
    await page.goto("/contacto");
    await expect(page.getByText(/se abrirá whatsapp/i)).toHaveCount(0);
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByLabel("Nombre completo")).toBeFocused();
    await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();
  });
});

test.describe("Etiqueta de Ads (solo en /, /paginas-web y las páginas legales)", () => {
  test.skip(!/^AW-\d{6,15}$/.test(ADS_ID), "Sin VITE_GADS_ID falso en el servidor de la app (p. ej. VITE_GADS_ID=AW-1000000000) no hay etiqueta que probar.");

  test("/?gclid=x carga la etiqueta", async ({ page }) => {
    const tag = page.waitForRequest(ADS_TAG, { timeout: 10_000 });
    await page.goto("/?gclid=x");
    expect((await tag).url()).toContain(`id=${ADS_ID}`);
    await expect(page.locator(`script[src*="googletagmanager.com"]`)).toHaveCount(1);
  });

  for (const path of ["/planes", "/servicios", "/contacto"] as const) {
    test(`${path}?gclid=x no carga la etiqueta`, async ({ page }) => {
      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      await page.goto(`${path}?gclid=x`);
      await expect(h1(page)).toBeVisible();
      // Se espera a que la app termine de arrancar y se mira de nuevo: un efecto tardío también cuenta.
      await page.waitForTimeout(1500);
      expect(requests.filter((url) => ADS_TAG.test(url))).toEqual([]);
      await expect(page.locator(`script[src*="googletagmanager.com"]`)).toHaveCount(0);
    });
  }

  test("llegar a /planes desde la home no envía la visita a la etiqueta ni vuelve a cargarla", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?gclid=x");
    await expect(page.locator(`script[src*="googletagmanager.com"]`)).toHaveCount(1);
    await page.getByRole("link", { name: "Ver planes" }).click();
    await expect(page).toHaveURL(/\/planes\?gclid=x$/);
    await expect(page.locator(`script[src*="googletagmanager.com"]`)).toHaveCount(1);
  });
});

test.describe("Accesibilidad medida en el navegador (WCAG 2.2)", () => {
  for (const view of VIEWS) {
    test(`${view.name}: el foco con Mayús+Tab no queda tapado por la cabecera fija (2.4.11)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 800 });
      await page.goto(view.path);
      await expect(h1(page)).toBeVisible();
      // Se parte del último enlace del pie y se retrocede por toda la página.
      await page.evaluate(() => (document.querySelector("footer a:last-of-type") as HTMLElement | null)?.focus());
      const hidden: string[] = [];
      for (let i = 0; i < 90; i++) {
        await page.keyboard.press("Shift+Tab");
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const header = document.querySelector("header");
          if (!el || !header || el === document.body || header.contains(el)) return null;
          // El enlace de salto se dibuja por encima de la cabecera (z-index mayor): no queda tapado.
          if (el.textContent?.trim() === "Saltar al contenido") return null;
          const { top, bottom } = el.getBoundingClientRect();
          return bottom <= header.getBoundingClientRect().bottom ? `${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)} (top ${Math.round(top)})` : null;
        });
        if (state) hidden.push(state);
      }
      expect(hidden).toEqual([]);
    });
  }

  for (const view of VIEWS) {
    for (const width of [1440, 390] as const) {
      test(`${view.name} a ${width} px: los controles miden al menos 24x24 px (2.5.8)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(view.path);
        await expect(h1(page)).toBeVisible();
        const small = await page.evaluate(() => {
          const out: string[] = [];
          const controls = document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), textarea, select, [role=checkbox], [role=button]");
          for (const el of controls) {
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none" || el.closest("[hidden]")) continue;
            const { width: w, height: h } = el.getBoundingClientRect();
            if (w === 0 || h === 0) continue;
            // El enlace de salto solo se ve con el foco: fuera de él mide 1x1 a propósito (sr-only).
            if (el.textContent?.trim() === "Saltar al contenido") continue;
            // Enlace de una tarjeta clicable: su ::after cubre toda la tarjeta y el objetivo real es esa tarjeta.
            const after = getComputedStyle(el, "::after");
            if (after.position === "absolute" && after.content !== "none") continue;
            // Enlace dentro de una frase: la excepción de «en línea» de 2.5.8.
            if (style.display === "inline" && el.closest("p, li")) continue;
            if (w < 24 || h < 24) out.push(`${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)} ${Math.round(w)}x${Math.round(h)}`);
          }
          return out;
        });
        expect(small).toEqual([]);
      });
    }
  }

  test.describe("con prefers-reduced-motion: reduce", () => {
    test.use({ reducedMotion: "reduce" });

    for (const view of VIEWS) {
      test(`${view.name}: nada se mueve y todo el contenido es visible`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(view.path);
        await expect(h1(page)).toBeVisible();
        // Se recorre la página: las entradas por scroll no deben dejar nada oculto.
        await page.evaluate(async () => {
          for (let y = 0; y <= document.documentElement.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(1800); // más que el intervalo de las píldoras del titular (1,5 s)

        const state = await page.evaluate(() => {
          const invisible: string[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const el = node.parentElement;
            if (!el || !node.nodeValue?.trim() || el.closest("[hidden], script, style, .sr-only")) continue;
            const { width, height } = el.getBoundingClientRect();
            if (width < 2 || height < 2) continue;
            let opacity = 1;
            for (let e: Element | null = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
            if (opacity < 0.99) invisible.push(node.nodeValue.trim().slice(0, 30));
          }
          return {
            animations: document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? a.constructor.name),
            hiddenReveals: document.querySelectorAll('[data-site-reveal="hidden"]').length,
            rails: [...document.querySelectorAll<HTMLElement>("h1 [style*='translateY']")].map((rail) => rail.style.transform),
            invisible,
          };
        });
        expect(state.animations).toEqual([]);
        expect(state.hiddenReveals).toBe(0);
        expect(state.invisible).toEqual([]);
        // Las píldoras del titular se quedan en su primer estado.
        for (const rail of state.rails) expect(rail).toBe("translateY(0%)");
      });
    }
  });
});
