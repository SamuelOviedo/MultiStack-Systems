import { test, expect, type Page } from "@playwright/test";

// Crédito «Desarrollado por MultiStack Systems» en el pie de la home, de /planes (pie del sitio nuevo) y de /paginas-web
// (pie anterior), en modo sitio propio del estándar docs/standards/CREDITO-MULTISTACK.md. Sin red: lo que no es el origen
// de la app se aborta. El pie del sitio nuevo usa Poppins y JetBrains Mono locales, así que se mide con la fuente real (se
// espera a document.fonts.ready); el pie anterior usa las de Google Fonts, que aquí no cargan, y se mide con la de reserva
// (más estrecha). Se comprueba visibilidad, desbordamiento, área de toque, qué recibe un toque en el copyright, disposición
// y contraste.

// 320 px es el ancho de los móviles más estrechos: ahí el crédito (unos 286 px, sin partirse) cabe justo en la barra
// con el relleno de 16 px del pie. Por debajo de unos 300 px puede no caber (estándar, sección 13).
const ANCHOS = [320, 360, 390, 1440] as const;
// Rutas con el pie anterior (src/components/common/Footer.tsx): hoy solo /paginas-web.
const RUTAS_PIE_ANTERIOR = ["/paginas-web"] as const;
// Gutter mínimo a cada lado: el crédito no invade el relleno lateral del pie.
const GUTTER = 16;
const NOMBRE = "Desarrollado por MultiStack Systems";

type Pie = {
  ruta: string;
  /** Barra inferior del pie. */
  barra: string;
  /** Elemento del copyright; sin valor, el copyright es el primer nodo de texto de la barra. */
  copia: string | null;
  separador: string;
};

const NUEVO = { barra: ".site-foot-bar", copia: ".site-foot-copy", separador: ".site-foot-sep" } as const;
const PIES: readonly Pie[] = [
  { ruta: "/", ...NUEVO },
  { ruta: "/planes", ...NUEVO },
  { ruta: "/paginas-web", barra: ".ms-footer-bar", copia: null, separador: ".ms-footer-bar__sep" },
];

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
  await page.evaluate(async () => {
    await document.fonts.ready;
    return true;
  });
  return credito;
}

for (const pie of PIES) {
  for (const ancho of ANCHOS) {
    test.describe(`${pie.ruta} a ${ancho}px`, () => {
      test.use({ viewport: { width: ancho, height: 800 } });

      test("hay un solo crédito, se ve, sin scroll horizontal, y apunta a la home en la misma pestaña", async ({ page }) => {
        const credito = await abrirPie(page, pie.ruta);
        await expect(page.getByRole("link", { name: /Desarrollado por MultiStack Systems/ })).toHaveCount(1);
        await expect(credito).toHaveAttribute("href", "/");
        await expect(credito).not.toHaveAttribute("target", /.*/);
        await expect(credito).not.toHaveAttribute("rel", /.*/);
        const medidas = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          ancho: document.documentElement.clientWidth,
        }));
        // En todos los anchos, 320 incluido, el documento no desborda; y el pie no desborda y el crédito queda dentro, sin
        // invadir el relleno lateral.
        expect(medidas.scroll).toBeLessThanOrEqual(medidas.ancho);
        const caja = await page.evaluate(() => {
          const el = document.querySelector("footer")!;
          const enlace = el.querySelector("a[href=\"/\"][aria-label^=\"Desarrollado\"]")!.getBoundingClientRect();
          return { scroll: el.scrollWidth, ancho: el.clientWidth, izquierda: enlace.left, derecha: enlace.right, ventana: document.documentElement.clientWidth };
        });
        expect(caja.scroll).toBeLessThanOrEqual(caja.ancho);
        expect(caja.izquierda).toBeGreaterThanOrEqual(GUTTER);
        expect(caja.derecha).toBeLessThanOrEqual(caja.ventana - GUTTER);
      });

      test("el crédito queda dentro del relleno de la barra y el pie usa el mismo gutter en columnas y barra", async ({ page }) => {
        test.skip(pie.barra !== ".ms-footer-bar", "El gutter de 16/32 px es del pie anterior.");
        const credito = await abrirPie(page, pie.ruta);
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
        const credito = await abrirPie(page, pie.ruta);
        const caja = await credito.boundingBox();
        expect(caja!.height).toBeGreaterThanOrEqual(44);
      });

      test("tocar el copyright no cae en el enlace", async ({ page }) => {
        await abrirPie(page, pie.ruta);
        const resultado = await page.evaluate(({ barra, copia }) => {
          const el = document.querySelector(barra)!;
          const rango = document.createRange();
          // El copyright es el elemento `copia` o, en el pie anterior, el primer nodo de la barra.
          if (copia) rango.selectNodeContents(el.querySelector(copia)!);
          else rango.selectNodeContents(el.firstChild as Text);
          const golpes: string[] = [];
          for (const r of rango.getClientRects()) {
            for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
              for (const fy of [0.1, 0.5, 0.9]) {
                const golpe = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
                golpes.push(golpe?.closest("a") ? "enlace" : "otro");
              }
            }
          }
          return { puntos: golpes.length, enlaces: golpes.filter((g) => g === "enlace").length };
        }, pie);
        expect(resultado.puntos).toBeGreaterThan(0);
        expect(resultado.enlaces).toBe(0);
      });

      test("disposición: en su propia línea en móvil, al lado del copyright en escritorio", async ({ page }) => {
        await abrirPie(page, pie.ruta);
        const d = await page.evaluate(({ barra, copia, separador }) => {
          const el = document.querySelector(barra)!;
          const rango = document.createRange();
          if (copia) rango.selectNodeContents(el.querySelector(copia)!);
          else rango.selectNodeContents(el.firstChild as Text);
          const copy = rango.getBoundingClientRect();
          const enlace = el.querySelector("a")!.getBoundingClientRect();
          const sep = getComputedStyle(el.querySelector(separador)!).display;
          return { copyAbajo: copy.bottom, enlaceArriba: enlace.top, copyDerecha: copy.right, enlaceIzquierda: enlace.left, sep };
        }, pie);
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
for (const ruta of RUTAS_PIE_ANTERIOR) {
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
test.describe("/paginas-web a 1440px en táctil: crecimiento de la barra", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("la barra crece como mucho 12 px por el crédito", async ({ page }) => {
    await abrirPie(page, "/paginas-web");
    const { con, sin } = await altosDeLaBarra(page);
    expect(con - sin).toBeGreaterThanOrEqual(0);
    expect(con - sin).toBeLessThanOrEqual(12);
  });
});

// Solo el pie del sitio nuevo: el copyright no se mueve, el crédito tiene el tamaño del copyright y el contraste cumple.
for (const ruta of ["/", "/planes"] as const) {
  for (const ancho of ANCHOS) {
    test.describe(`${ruta} a ${ancho}px · pie del sitio`, () => {
      test.use({ viewport: { width: ancho, height: 800 } });

      test("el copyright sigue centrado en la barra y el crédito no desborda por la derecha", async ({ page }) => {
        const credito = await abrirPie(page, ruta);
        const d = await page.evaluate(() => {
          const rango = document.createRange();
          rango.selectNodeContents(document.querySelector(".site-foot-copy")!);
          const copia = rango.getBoundingClientRect();
          const enlace = document.querySelector(".site-foot-bar a")!.getBoundingClientRect();
          return { centro: (copia.left + copia.right) / 2, ancho: document.documentElement.clientWidth, enlaceDerecha: enlace.right };
        });
        expect(Math.abs(d.centro - d.ancho / 2)).toBeLessThanOrEqual(1);
        expect(d.enlaceDerecha).toBeLessThanOrEqual(d.ancho);
        await expect(credito).toBeInViewport();
      });

      test("tiene el tamaño y la fuente del copyright", async ({ page }) => {
        await abrirPie(page, ruta);
        const d = await page.evaluate(() => {
          const a = getComputedStyle(document.querySelector(".site-foot-bar a")!);
          const c = getComputedStyle(document.querySelector(".site-foot-copy")!);
          return { a: [a.fontSize, a.fontFamily, a.lineHeight], c: [c.fontSize, c.fontFamily, c.lineHeight] };
        });
        expect(d.a).toEqual(d.c);
      });

      test("contraste: texto en reposo 4,5:1 o más y cada parada de la M 3:1 o más sobre el fondo del pie", async ({ page }) => {
        await abrirPie(page, ruta);
        const d = await page.evaluate(() => {
          // El navegador resuelve oklch(); el lienzo lo pasa a sRGB.
          const rgb = (css: string) => {
            const lienzo = document.createElement("canvas");
            lienzo.width = lienzo.height = 1;
            const g = lienzo.getContext("2d", { willReadFrequently: true })!;
            g.fillStyle = "#000";
            g.fillStyle = css;
            g.fillRect(0, 0, 1, 1);
            return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
          };
          const enlace = document.querySelector(".site-foot-bar a")!;
          const fondo = rgb(getComputedStyle(document.querySelector("footer")!).backgroundColor);
          const texto = rgb(getComputedStyle(enlace).color);
          return { fondo, texto, opacidad: Number(getComputedStyle(enlace).opacity) };
        });
        const L = (c: number[]) =>
          c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        const mezcla = d.texto.map((v, i) => Math.round(d.opacidad * v + (1 - d.opacidad) * d.fondo[i]));
        expect(ratio(mezcla, d.fondo)).toBeGreaterThanOrEqual(4.5);
        expect(ratio([0x13, 0x75, 0x90], d.fondo)).toBeGreaterThanOrEqual(3);
        expect(ratio([0x06, 0x8d, 0xb3], d.fondo)).toBeGreaterThanOrEqual(3);
      });
    });
  }
}
