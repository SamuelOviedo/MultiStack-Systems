import { test, expect, type Page } from "@playwright/test";

// Crédito «Desarrollado por MultiStack Systems» en el pie de la home y de /paginas-web (modo sitio propio del
// estándar docs/standards/CREDITO-MULTISTACK.md). Sin red: lo que no es el origen de la app se aborta, así que las
// tipografías remotas no cargan y se mide con la de reserva; eso no afecta a lo que se comprueba aquí (visibilidad,
// desbordamiento, área de toque y qué recibe un toque en el copyright).

// 320 px es el ancho de los móviles más estrechos: ahí el crédito (unos 286 px, sin partirse) cabe justo en la barra
// con el relleno de 16 px del pie. Por debajo de unos 300 px puede no caber (estándar, sección 13).
const ANCHOS = [320, 360, 390, 1440] as const;
const RUTAS = ["/", "/paginas-web"] as const;
const NOMBRE = "Desarrollado por MultiStack Systems";

// Táctil real: hasTouch + isMobile hacen verdadero (pointer: coarse), que es lo que activa el área de 44 px.
test.use({ hasTouch: true, isMobile: true });

async function abrirPie(page: Page, ruta: string) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.goto(ruta);
  const credito = page.getByRole("link", { name: NOMBRE });
  await credito.scrollIntoViewIfNeeded();
  await expect(credito).toBeVisible();
  return credito;
}

for (const ruta of RUTAS) {
  for (const ancho of ANCHOS) {
    test.describe(`${ruta} a ${ancho}px`, () => {
      test.use({ viewport: { width: ancho, height: 800 } });

      test("el crédito se ve, sin scroll horizontal, y apunta a la home en la misma pestaña", async ({ page }) => {
        const credito = await abrirPie(page, ruta);
        await expect(credito).toHaveAttribute("href", "/");
        await expect(credito).not.toHaveAttribute("target", /.*/);
        await expect(credito).not.toHaveAttribute("rel", /.*/);
        const medidas = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          ancho: document.documentElement.clientWidth,
        }));
        expect(medidas.scroll).toBeLessThanOrEqual(medidas.ancho);
      });

      test("el crédito queda dentro del relleno de la barra y el pie usa el mismo gutter en columnas y barra", async ({ page }) => {
        const credito = await abrirPie(page, ruta);
        const m = await page.evaluate(() => {
          const barra = document.querySelector<HTMLElement>(".ms-footer-bar")!;
          const columnas = document.querySelector<HTMLElement>(".ms-footer-grid")!;
          const sb = getComputedStyle(barra);
          const sc = getComputedStyle(columnas);
          const caja = barra.getBoundingClientRect();
          const enlace = barra.querySelector("a")!.getBoundingClientRect();
          return {
            barraIzq: sb.paddingLeft,
            barraDer: sb.paddingRight,
            colIzq: sc.paddingLeft,
            colDer: sc.paddingRight,
            // Borde útil de la barra: dentro del relleno, no sobre él.
            utilIzq: caja.left + parseFloat(sb.paddingLeft),
            utilDer: caja.right - parseFloat(sb.paddingRight),
            enlaceIzq: enlace.left,
            enlaceDer: enlace.right,
          };
        });
        await expect(credito).toBeVisible();
        const gutter = ancho <= 480 ? "16px" : "32px";
        expect([m.barraIzq, m.barraDer, m.colIzq, m.colDer]).toEqual([gutter, gutter, gutter, gutter]);
        expect(m.enlaceIzq).toBeGreaterThanOrEqual(m.utilIzq - 0.5);
        expect(m.enlaceDer).toBeLessThanOrEqual(m.utilDer + 0.5);
      });

      test("en táctil mide 44 px o más de alto", async ({ page }) => {
        const credito = await abrirPie(page, ruta);
        const caja = await credito.boundingBox();
        expect(caja!.height).toBeGreaterThanOrEqual(44);
      });

      test("tocar el copyright no cae en el enlace", async ({ page }) => {
        await abrirPie(page, ruta);
        const resultado = await page.evaluate(() => {
          const barra = document.querySelector(".ms-footer-bar")!;
          const texto = barra.firstChild as Text; // el copyright es el primer nodo de la barra
          const rango = document.createRange();
          rango.selectNodeContents(texto);
          const cajas = [...rango.getClientRects()];
          const golpes: string[] = [];
          for (const r of cajas) {
            for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
              for (const fy of [0.1, 0.5, 0.9]) {
                const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
                golpes.push(el?.closest("a") ? "enlace" : "otro");
              }
            }
          }
          return { puntos: golpes.length, enlaces: golpes.filter((g) => g === "enlace").length };
        });
        expect(resultado.puntos).toBeGreaterThan(0);
        expect(resultado.enlaces).toBe(0);
      });

      test("disposición: en su propia línea en móvil, al lado del copyright en escritorio", async ({ page }) => {
        await abrirPie(page, ruta);
        const d = await page.evaluate(() => {
          const barra = document.querySelector(".ms-footer-bar")!;
          const rango = document.createRange();
          rango.selectNodeContents(barra.firstChild as Text);
          const copy = rango.getBoundingClientRect();
          const enlace = barra.querySelector("a")!.getBoundingClientRect();
          const sep = getComputedStyle(barra.querySelector(".ms-footer-bar__sep")!).display;
          return { copyAbajo: copy.bottom, enlaceArriba: enlace.top, copyDerecha: copy.right, enlaceIzquierda: enlace.left, sep };
        });
        if (ancho >= 1000) {
          expect(d.sep).not.toBe("none");
          expect(d.enlaceIzquierda).toBeGreaterThan(d.copyDerecha);
          expect(d.enlaceArriba).toBeLessThan(d.copyAbajo);
        } else {
          expect(d.sep).toBe("none");
          expect(d.enlaceArriba).toBeGreaterThanOrEqual(d.copyAbajo - 1);
        }
      });
    });
  }
}

// Alto de la barra con el crédito y con el crédito y su separador ocultos (display: none), en la misma página.
async function altosDeLaBarra(page: Page) {
  return page.evaluate(() => {
    const barra = document.querySelector<HTMLElement>(".ms-footer-bar")!;
    const piezas = [...barra.querySelectorAll<HTMLElement>("a, .ms-footer-bar__sep")];
    const con = barra.getBoundingClientRect().height;
    piezas.forEach((el) => (el.style.display = "none"));
    const sin = barra.getBoundingClientRect().height;
    return { con, sin };
  });
}

// Ratón (puntero fino, sin táctil): no hay área de 44 px ni margen negativo. Aquí se ve el pie de escritorio tal como
// lo ve quien no usa pantalla táctil.
for (const ruta of RUTAS) {
  test.describe(`${ruta} a 1440px con ratón`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

    test("el crédito va al lado del copyright, en la misma línea", async ({ page }) => {
      const credito = await abrirPie(page, ruta);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(false);
      const d = await page.evaluate(() => {
        const barra = document.querySelector(".ms-footer-bar")!;
        const rango = document.createRange();
        rango.selectNodeContents(barra.firstChild as Text);
        const copy = rango.getBoundingClientRect();
        const enlace = barra.querySelector("a")!.getBoundingClientRect();
        return { copyDerecha: copy.right, copyArriba: copy.top, copyAbajo: copy.bottom, enlaceIzq: enlace.left, enlaceArriba: enlace.top, enlaceAbajo: enlace.bottom };
      });
      expect(d.enlaceIzq).toBeGreaterThan(d.copyDerecha);
      expect(d.enlaceArriba).toBeLessThan(d.copyAbajo);
      expect(d.enlaceAbajo).toBeGreaterThan(d.copyArriba);
      await expect(credito).toHaveCSS("display", "inline-flex");
    });

    test("la barra mide lo mismo con el crédito que sin él", async ({ page }) => {
      await abrirPie(page, ruta);
      const { con, sin } = await altosDeLaBarra(page);
      expect(Math.abs(con - sin)).toBeLessThanOrEqual(1);
    });
  });
}

// Táctil a 1440 px: el crédito va al lado, pero su zona de 44 px hace crecer la barra unos píxeles (estándar, sección 13).
// Se acota para que no vuelva a crecer sin que nadie lo note.
test.describe("/ a 1440px en táctil: crecimiento de la barra", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("la barra crece como mucho 12 px por el crédito", async ({ page }) => {
    await abrirPie(page, "/");
    const { con, sin } = await altosDeLaBarra(page);
    expect(con - sin).toBeGreaterThanOrEqual(0);
    expect(con - sin).toBeLessThanOrEqual(12);
  });
});
