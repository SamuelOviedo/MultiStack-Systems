// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

// Contraste (WCAG 1.4.3, AA: 4.5:1 en texto normal, 3:1 en texto grande y en componentes de interfaz) de los pares de
// colores del sitio, calculado desde los tokens de site.css. La paleta de la referencia no llegaba a AA en tres casos
// (A11Y-1, A11Y-2 y A11Y-5); se corrigieron con retoques pequeños y estas pruebas los fijan. Cada una se contrastó con lo
// que mide el navegador (axe y muestreo de píxeles): p. ej. el teal de marca sobre la tarjeta destacada da 3,96 en el
// navegador y 3,94 aquí.
//
// Se lee site.css con fs y postcss: Vitest devuelve una cadena vacía para un `?raw` de CSS. Las pruebas no escriben
// nombres de clases de Tailwind (la hoja los escanearía): los patrones de búsqueda se arman en ejecución.

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const CSS = read("src/components/site/site.css");

type Rgb = readonly [number, number, number];

/** Canales «L C H» de un token `--site-*` (sin alfa) del bloque `.ms-site { … }`. */
function token(name: string): { l: number; c: number; h: number } {
  let value: string | undefined;
  postcss.parse(CSS).walkRules(".ms-site", (rule) => {
    rule.walkDecls(name, (decl) => void (value ??= decl.value));
  });
  const parts = (value ?? "").trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error(`Falta el token ${name} en site.css (${value}).`);
  return { l: parts[0]!, c: parts[1]!, h: parts[2]! };
}

/** oklch -> sRGB lineal, recortado al gamut (como lo pinta el navegador cuando el color no cabe en sRGB). */
function linearSrgb({ l, c, h }: { l: number; c: number; h: number }): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (n: number) => Math.min(1, Math.max(0, n));
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

// El navegador mezcla capas, alfa e interpolación de degradados sobre los valores sRGB codificados (con gamma), no sobre los
// lineales: por eso las mezclas de abajo codifican, mezclan y vuelven a lineal. El contraste se mide siempre en lineal.
const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (rgb: Rgb) => rgb.map(encode) as unknown as Rgb;
const fromGamma = (rgb: Rgb) => rgb.map(decode) as unknown as Rgb;
/** `top` con opacidad `alpha` sobre `bottom`. */
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb => {
  const [t, b] = [toGamma(top), toGamma(bottom)];
  return fromGamma(t.map((v, i) => v * alpha + b[i]! * (1 - alpha)) as unknown as Rgb);
};
/** Punto intermedio de dos colores (como interpola un degradado). */
const lerp = (a: Rgb, b: Rgb, t: number): Rgb => over(b, t, a);
/** `filter: brightness(k)`: multiplica los canales sRGB codificados y recorta. */
const brighten = (rgb: Rgb, k: number): Rgb => fromGamma(toGamma(rgb).map((v) => Math.min(1, v * k)) as unknown as Rgb);
const hex = (value: string): Rgb => {
  const n = parseInt(value.replace("#", ""), 16);
  return fromGamma([(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
};

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const contrast = (x: Rgb, y: Rgb) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi! + 0.05) / (lo! + 0.05);
};

const color = (name: string) => linearSrgb(token(name));
const WHITE = linearSrgb({ l: 0.99, c: 0, h: 0 }); // --site-primary-foreground

/** Las puntas del degradado de marca (`--site-gradient-brand`): el texto blanco de los botones se lee sobre cualquier punto. */
function gradientStops(): Rgb[] {
  let value = "";
  postcss.parse(CSS).walkDecls("--site-gradient-brand", (decl) => void (value ||= decl.value));
  const stops = [...value.matchAll(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)].map((m) => linearSrgb({ l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) }));
  if (stops.length < 2) throw new Error("No se leyó el degradado de marca de site.css.");
  return stops;
}

const AA = 4.5;
const AA_LARGE = 3;

describe("site.css: el conversor de color es fiable", () => {
  it("el teal de marca da lo que mide el navegador (#008eb6 sobre medianoche: unos 5:1)", () => {
    const ratio = contrast(color("--site-primary"), color("--site-background"));
    expect(ratio).toBeGreaterThan(4.9);
    expect(ratio).toBeLessThan(5.4);
  });

  it("blanco sobre negro da 21:1", () => {
    expect(contrast([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 5);
  });

  it("mezclar en sRGB codificado reproduce lo que pinta el navegador (teal al 15 % sobre la tarjeta: rgb 12 41 54)", () => {
    const chip = over(color("--site-primary"), 0.15, color("--site-card"));
    const rgb = chip.map((v) => Math.round(encode(v) * 255));
    [12, 41, 54].forEach((expected, i) => expect(Math.abs(rgb[i]! - expected)).toBeLessThanOrEqual(1));
  });
});

describe("contraste AA de los pares de color del sitio", () => {
  const BACKGROUNDS = ["--site-background", "--site-surface", "--site-card"] as const;

  it.each(BACKGROUNDS)("texto principal sobre %s", (bg) => {
    expect(contrast(color("--site-foreground"), color(bg))).toBeGreaterThanOrEqual(AA);
  });

  it.each(BACKGROUNDS)("texto atenuado (muted-foreground) sobre %s", (bg) => {
    expect(contrast(color("--site-muted-foreground"), color(bg))).toBeGreaterThanOrEqual(AA);
  });

  it("texto atenuado sobre muted y sobre secondary", () => {
    for (const bg of ["--site-muted", "--site-secondary"]) {
      expect(contrast(color("--site-muted-foreground"), color(bg)), bg).toBeGreaterThanOrEqual(AA);
    }
  });

  it("el teal de marca como texto sobre la medianoche, la superficie y la tarjeta", () => {
    for (const bg of BACKGROUNDS) expect(contrast(color("--site-primary"), color(bg)), bg).toBeGreaterThanOrEqual(AA);
  });

  it("el anillo de foco frente a la medianoche cumple 3:1 de componente de interfaz (WCAG 1.4.11)", () => {
    expect(contrast(color("--site-ring"), color("--site-background"))).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("verde de éxito y rojo de error sobre la medianoche", () => {
    expect(contrast(color("--site-success"), color("--site-background"))).toBeGreaterThanOrEqual(AA);
    expect(contrast(color("--site-destructive"), color("--site-background"))).toBeGreaterThanOrEqual(AA);
  });
});

// A11Y-1: el teal de marca como texto de 12-14 px sobre la tarjeta destacada (accent, 3,96:1), el chip de estado y el panel
// de actualización no llegaba a 4,5:1 («entrega: …» del Plan Intermedio, «en desarrollo», «actualización:» y «Compara todo lo que
// incluye cada plan»; medido en el navegador: 3,96 / 4,00 / 4,22 / 4,29). El texto pequeño en teal usa --site-primary-text,
// un poco más claro; fondos, bordes, brillos e íconos siguen con --site-primary.
describe("A11Y-1: el teal como texto pequeño (--site-primary-text)", () => {
  const SURFACES = ["--site-background", "--site-surface", "--site-card", "--site-accent", "--site-muted", "--site-secondary"] as const;
  const text = () => color("--site-primary-text");

  it.each(SURFACES)("llega a AA sobre %s", (bg) => {
    expect(contrast(text(), color(bg))).toBeGreaterThanOrEqual(AA);
  });

  it("llega a AA sobre los chips de teal al 15 % (en tarjeta, en superficie y en fondo) y al 10 %", () => {
    for (const bg of ["--site-card", "--site-surface", "--site-background"]) {
      for (const alpha of [0.15, 0.1]) {
        expect(contrast(text(), over(color("--site-primary"), alpha, color(bg))), `${bg} ${alpha}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it("control: el teal de marca sin retoque sigue sin llegar a AA sobre la tarjeta destacada y sobre el chip (por eso existe el tono de texto)", () => {
    expect(contrast(color("--site-primary"), color("--site-accent"))).toBeLessThan(AA);
    expect(contrast(color("--site-primary"), over(color("--site-primary"), 0.15, color("--site-card")))).toBeLessThan(AA);
  });

  it("es el mismo teal, solo más claro (misma tonalidad y croma que --site-primary)", () => {
    const [text, brand] = [token("--site-primary-text"), token("--site-primary")];
    expect(text.h).toBe(brand.h);
    expect(text.c).toBe(brand.c);
    expect(text.l - brand.l).toBeGreaterThan(0);
    expect(text.l - brand.l).toBeLessThanOrEqual(0.06);
  });
});

// A11Y-2: el texto blanco de los botones y de las insignias («Cotizar mi web», «Ver planes», «Solicitar …», «Más elegido»,
// «Promoción del año», «Entrar a mi panel») sobre el degradado de marca. La punta clara del degradado anterior daba 3,7:1;
// medido sobre los botones reales, donde el texto no cae justo en la punta: 3,84 a 4,45. Se oscurecieron las dos puntas y
// los estados hover (el brillo del botón y la capa clara del botón doble del hero).
describe("A11Y-2: texto blanco sobre el degradado de marca", () => {
  it("el blanco llega a AA en las dos puntas del degradado (y, al ser lineal, en todo el recorrido)", () => {
    for (const stop of gradientStops()) expect(contrast(WHITE, stop)).toBeGreaterThanOrEqual(AA);
  });

  it("el blanco llega a AA en todo el recorrido: puntos intermedios del degradado", () => {
    const [from, to] = [gradientStops()[0]!, gradientStops().at(-1)!];
    for (let i = 0; i <= 20; i++) expect(contrast(WHITE, lerp(from, to, i / 20)), `t=${i / 20}`).toBeGreaterThanOrEqual(AA);
  });

  it("el botón con degradado sigue en AA con el brillo del hover", () => {
    const source = read("src/components/site/siteButtonVariants.ts");
    const match = source.match(new RegExp(["hover", "brightness-(\\d+)"].join(":")));
    if (!match) throw new Error("No se encontró el brillo de hover de la variante hero.");
    const factor = Number(match[1]) / 100;
    expect(factor).toBeGreaterThan(1); // sigue habiendo respuesta visible al pasar el puntero
    for (const stop of gradientStops()) expect(contrast(WHITE, brighten(stop, factor)), `brillo ${factor}`).toBeGreaterThanOrEqual(AA);
  });

  it("la capa clara del hover del botón doble del hero llega a AA en todas sus paradas", () => {
    const source = read("src/components/site/SiteButton.tsx");
    const layer = source.match(/linear-gradient\(90deg,([^\]]+)\]/);
    if (!layer) throw new Error("No se encontró el degradado de hover del botón del hero.");
    const stops = [...layer[1]!.matchAll(/oklch\(([\d.]+)_([\d.]+)_([\d.]+)\)/g)].map((m) => linearSrgb({ l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) }));
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const stop of stops) expect(contrast(WHITE, stop)).toBeGreaterThanOrEqual(AA);
    for (let i = 0; i < stops.length - 1; i++) {
      for (let t = 0; t <= 10; t++) expect(contrast(WHITE, lerp(stops[i]!, stops[i + 1]!, t / 10))).toBeGreaterThanOrEqual(AA);
    }
  });

  it("el relleno sólido con texto blanco (insignia de la cabecera, enlace de salto) usa el teal profundo y llega a AA", () => {
    expect(contrast(WHITE, color("--site-primary-deep"))).toBeGreaterThanOrEqual(AA);
  });

  it("control: el blanco sobre el teal de marca (--site-primary) no llega a AA, por eso no se usa de relleno con texto", () => {
    expect(contrast(WHITE, color("--site-primary"))).toBeLessThan(AA);
  });
});

// A11Y-5: el texto atenuado del hero (el subtítulo y las etiquetas de los datos) sobre el brillo teal de las ondas daba entre
// 3,2 y 4,3:1 medido en el navegador. Se refuerza un poco el velo de la franja del texto (`.hero-text-veil`) y el texto usa
// --site-hero-muted. Con las ondas WebGL el fondo cambia en cada cuadro, pero nunca es más claro que el degradado de respaldo
// (que usa el movimiento reducido y se pinta antes del shader): se modela ese caso, con el velo, la cuadrícula y el fundido
// inferior de Hero.tsx. El modelo coincide con lo medido en el navegador a menos de 10 niveles por canal, en un sentido o en el otro: con el
// retoque da 4,8:1 en el peor punto y el navegador, 5,1 como mínimo. Se evalúa el peor píxel (una línea de cuadrícula incluida).
describe("A11Y-5: texto atenuado del hero sobre las ondas (degradado de respaldo)", () => {
  /** Paradas `#hex N%` del degradado de respaldo de `.waves`, de abajo hacia arriba. */
  function wavesStops(): { at: number; rgb: Rgb }[] {
    let value = "";
    postcss.parse(CSS).walkRules(".ms-site .waves", (rule) => rule.walkDecls("background", (d) => void (value ||= d.value)));
    const stops = [...value.matchAll(/(#[0-9a-f]{6})\s+([\d.]+)%/gi)].map((m) => ({ rgb: hex(m[1]!), at: Number(m[2]) / 100 }));
    if (stops.length < 4) throw new Error("No se leyó el degradado de respaldo de .waves.");
    return stops;
  }

  /** Velo bajo el texto (`.hero-text-veil`): elipse en px de ancho y % de alto, con alfa en el centro y en la meseta. */
  function textVeil() {
    let value = "";
    postcss.parse(CSS).walkRules(".ms-site .hero-text-veil", (rule) => rule.walkDecls("background", (d) => void (value ||= d.value)));
    const shape = value.match(/ellipse\s+([\d.]+)px\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%/);
    const alphas = [...value.matchAll(/\/\s*([\d.]+)\)(?:\s+([\d.]+)%)?/g)].map((m) => ({ alpha: Number(m[1]), at: m[2] === undefined ? 0 : Number(m[2]) / 100 }));
    if (!shape || alphas.length < 2) throw new Error(`No se leyó el velo del texto del hero (${value}).`);
    return { rx: Number(shape[1]), ry: Number(shape[2]) / 100, cx: Number(shape[3]) / 100, cy: Number(shape[4]) / 100, core: alphas[0]!, plateau: alphas[1]! };
  }

  // Hero.tsx: el velo central (0,55 -> 0,15), el que ya existía; la guarda avisa si alguien lo cambia sin actualizar el modelo.
  const HERO = read("src/components/site/home/Hero.tsx");
  const CENTRAL_VEIL = { rx: 0.7, ry: 0.55, cx: 0.5, cy: 0.45, inner: 0.55, outer: 0.15 };

  /** Fondo (lineal) del hero en (fx, fy), en fracciones del tamaño, sin contar el texto. */
  function backdrop(width: number, height: number, fx: number, fy: number, withTextVeil = true): Rgb {
    const bg = color("--site-background");
    // 1. Degradado de respaldo, `to top`: la parada 0 % está abajo.
    const stops = wavesStops();
    const t = 1 - fy;
    const hi = stops.findIndex((s) => s.at >= t);
    const [a, b] = hi <= 0 ? [stops[0]!, stops[Math.max(hi, 0)]!] : [stops[hi - 1]!, stops[hi]!];
    let rgb = a.at === b.at ? a.rgb : lerp(a.rgb, b.rgb, (t - a.at) / (b.at - a.at));
    // 2. Velo central de Hero.tsx.
    const c = CENTRAL_VEIL;
    const d1 = Math.hypot(((fx - c.cx) * width) / (c.rx * width), ((fy - c.cy) * height) / (c.ry * height));
    rgb = over(bg, d1 >= 1 ? c.outer : c.inner + (c.outer - c.inner) * d1, rgb);
    // 3. Velo bajo el texto.
    if (withTextVeil) {
      const v = textVeil();
      const d2 = Math.hypot(((fx - v.cx) * width) / v.rx, ((fy - v.cy) * height) / (v.ry * height));
      const alpha = d2 >= 1 ? 0 : d2 <= v.plateau.at ? v.core.alpha + ((v.plateau.alpha - v.core.alpha) * d2) / v.plateau.at : (v.plateau.alpha * (1 - d2)) / (1 - v.plateau.at);
      rgb = over(bg, alpha, rgb);
    }
    // 4. Cuadrícula: blanco al 5 % con opacidad 0,6 (el peor píxel es una línea, con la máscara a pleno).
    rgb = over([1, 1, 1], 0.05 * 0.6, rgb);
    // 5. Fundido inferior: los últimos 160 px (h-40) pasan de transparente a la medianoche.
    const fade = Math.min(1, Math.max(0, (fy * height - (height - 160)) / 160));
    return over(bg, fade, rgb);
  }

  // Zonas del texto atenuado medidas en el navegador (fracciones del ancho y del alto del hero): subtítulo y etiquetas de los datos.
  const VIEWS = [
    { name: "1440 px", width: 1440, height: 919, zones: [{ x: [0.3, 0.7], y: [0.59, 0.65] }, { x: [0.36, 0.67], y: [0.875, 0.9] }] },
    { name: "1024 px", width: 1024, height: 919, zones: [{ x: [0.2, 0.8], y: [0.59, 0.65] }, { x: [0.28, 0.72], y: [0.875, 0.9] }] },
    { name: "390 px", width: 390, height: 790, zones: [{ x: [0.05, 0.95], y: [0.4, 0.5] }, { x: [0.1, 0.9], y: [0.83, 0.88] }] },
  ] as const;

  function worstContrast(textColor: Rgb, withTextVeil: boolean) {
    let worst = Infinity;
    for (const view of VIEWS) {
      for (const zone of view.zones) {
        for (let i = 0; i <= 12; i++) {
          for (let j = 0; j <= 6; j++) {
            const fx = zone.x[0] + ((zone.x[1] - zone.x[0]) * i) / 12;
            const fy = zone.y[0] + ((zone.y[1] - zone.y[0]) * j) / 6;
            worst = Math.min(worst, contrast(textColor, backdrop(view.width, view.height, fx, fy, withTextVeil)));
          }
        }
      }
    }
    return worst;
  }

  it("el velo central de Hero.tsx sigue siendo el que modela la prueba", () => {
    expect(HERO).toContain("ellipse_70%_55%_at_50%_45%,oklch(0.155_0.014_250/0.55),oklch(0.155_0.014_250/0.15)");
  });

  it("el texto atenuado del hero llega a AA en el peor punto del degradado de respaldo", () => {
    expect(worstContrast(color("--site-hero-muted"), true)).toBeGreaterThanOrEqual(AA);
  });

  it("control: sin el retoque (gris atenuado de siempre y sin el velo nuevo) el modelo da menos de AA", () => {
    expect(worstContrast(color("--site-muted-foreground"), false)).toBeLessThan(AA);
  });

  it("el velo nuevo solo oscurece la franja del texto: no llega a los bordes de la pantalla ancha", () => {
    const v = textVeil();
    // A 1440 px el borde izquierdo queda fuera de la elipse: el fondo de ondas sigue igual de vivo a los lados.
    expect(v.rx).toBeLessThan((1440 / 2) * 0.95);
    expect(backdrop(1440, 919, 0.02, 0.7)).toEqual(backdrop(1440, 919, 0.02, 0.7, false));
  });

  it("el texto del hero sigue siendo atenuado: más claro que --site-muted-foreground pero bastante menos que el texto principal", () => {
    const [muted, hero, main] = [token("--site-muted-foreground"), token("--site-hero-muted"), token("--site-foreground")];
    expect(hero.l).toBeGreaterThan(muted.l);
    expect(hero.l - muted.l).toBeLessThanOrEqual(0.08);
    expect(main.l - hero.l).toBeGreaterThanOrEqual(0.15);
  });

  it("el nuevo tono del hero también cumple AA sobre la medianoche y la tarjeta (se usa solo en el hero, pero no debe romper en otra superficie)", () => {
    for (const bg of ["--site-background", "--site-surface", "--site-card"]) {
      expect(contrast(color("--site-hero-muted"), color(bg)), bg).toBeGreaterThanOrEqual(AA);
    }
  });
});
