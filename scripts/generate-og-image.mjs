/**
 * Genera la imagen social (Open Graph / Twitter) de la home: «Páginas web para negocios en Honduras».
 *
 * Salida : public/assets/images/og/og-home.v3.1200x630.png   (og:image, PNG para los rastreadores que rechazan WebP)
 *          public/assets/images/og/og-home.v3.1200x630.webp  (variante más ligera)
 *
 * Composición (SVG + sharp, sin fotografías ni fotogramas de la antigua landing de IA): degradado oscuro con la
 * cuadrícula MS de 52 px, el conjunto oficial isotipo + rótulo, el titular, una línea de apoyo, tres etiquetas y una
 * maqueta de teléfono hecha con formas (como la del hero de la home; no es la captura de ningún cliente).
 * Los textos son los de la home: titular y subtítulo del hero, nombres de los dos paquetes (PACKAGES) y la
 * ubicación. No lleva precios.
 *
 * Los archivos anteriores (og-ai.1200x630.*, og-ai.v2.1200x630.*) se conservan en disco: hay vistas previas ya
 * compartidas que los enlazan. Este script no los toca.
 *
 * Fuentes de la marca: src/assets/brand/isotipo-oscuro-2x.png y wordmark-oscuro-2x.png (oficiales, proporciones reales).
 *
 * Ejecutar: node scripts/generate-og-image.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "public", "assets", "images", "og");
const BRAND = resolve(root, "src", "assets", "brand");
const W = 1200;
const H = 630;

const FONT = "Sora, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'JetBrains Mono', Consolas, 'Courier New', monospace";

const MARK = { left: 72, top: 72, height: 40 };
const GAP = 11; // separación isotipo-rótulo: 0,28 de la altura, como en el Logo del sitio

const CHIPS = ["Combo Emprendedor", "Plan Estándar", "Hecho en Siguatepeque"];
const CHIP_Y = 452;
const CHIP_H = 44;
const CHIP_FONT = 18;
const CHIP_PAD = 22;
// Ancho aproximado de un carácter mono a CHIP_FONT: la etiqueta se mide por texto, no por la fuente instalada.
const chipWidth = (text) => Math.round(text.length * CHIP_FONT * 0.6 + CHIP_PAD * 2);

let chipX = 72;
const chips = CHIPS.map((text) => {
  const width = chipWidth(text);
  const svg = `<rect x="${chipX + 0.5}" y="${CHIP_Y + 0.5}" width="${width}" height="${CHIP_H}" rx="${CHIP_H / 2}" fill="none" stroke="#0ea5e9" stroke-opacity="0.5"/>
  <text x="${chipX + CHIP_PAD}" y="${CHIP_Y + 28.5}" font-family="${MONO}" font-size="${CHIP_FONT}" fill="#7dd3fc">${text}</text>`;
  chipX += width + 14;
  return svg;
}).join("\n  ");

// Maqueta de teléfono (decorativa): marco, notch, barra, bloque con titular y botón, tarjetas y mapa.
const PHONE = { x: 896, y: 96, w: 232, h: 438 };
const px = (dx) => PHONE.x + dx;
const py = (dy) => PHONE.y + dy;
const phone = `
  <g transform="rotate(4 ${PHONE.x + PHONE.w / 2} ${PHONE.y + PHONE.h / 2})">
    <rect x="${PHONE.x}" y="${PHONE.y}" width="${PHONE.w}" height="${PHONE.h}" rx="38" fill="#0f1c35" stroke="#1e3a5f" stroke-width="2"/>
    <rect x="${px(10)}" y="${py(10)}" width="${PHONE.w - 20}" height="${PHONE.h - 20}" rx="30" fill="#080f1e" stroke="#ffffff" stroke-opacity="0.08"/>
    <rect x="${px(89)}" y="${py(22)}" width="54" height="6" rx="3" fill="#f0f6ff" fill-opacity="0.18"/>
    <circle cx="${px(34)}" cy="${py(52)}" r="8" fill="#0ea5e9"/>
    <rect x="${px(50)}" y="${py(49)}" width="70" height="7" rx="3.5" fill="#f0f6ff" fill-opacity="0.16"/>
    <rect x="${px(24)}" y="${py(76)}" width="${PHONE.w - 48}" height="118" rx="14" fill="#0ea5e9" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.08"/>
    <rect x="${px(38)}" y="${py(92)}" width="150" height="11" rx="5" fill="#f0f6ff" fill-opacity="0.62"/>
    <rect x="${px(38)}" y="${py(112)}" width="110" height="11" rx="5" fill="#f0f6ff" fill-opacity="0.62"/>
    <rect x="${px(38)}" y="${py(134)}" width="130" height="7" rx="3.5" fill="#f0f6ff" fill-opacity="0.16"/>
    <rect x="${px(38)}" y="${py(158)}" width="96" height="24" rx="7" fill="#0ea5e9"/>
    <rect x="${px(24)}" y="${py(208)}" width="92" height="74" rx="10" fill="#0f1c35" stroke="#ffffff" stroke-opacity="0.08"/>
    <rect x="${px(124)}" y="${py(208)}" width="84" height="74" rx="10" fill="#0f1c35" stroke="#ffffff" stroke-opacity="0.08"/>
    <circle cx="${px(42)}" cy="${py(226)}" r="9" fill="#0ea5e9" fill-opacity="0.1" stroke="#0ea5e9" stroke-opacity="0.4"/>
    <circle cx="${px(142)}" cy="${py(226)}" r="9" fill="#0ea5e9" fill-opacity="0.1" stroke="#0ea5e9" stroke-opacity="0.4"/>
    <rect x="${px(34)}" y="${py(250)}" width="68" height="7" rx="3.5" fill="#f0f6ff" fill-opacity="0.16"/>
    <rect x="${px(134)}" y="${py(250)}" width="60" height="7" rx="3.5" fill="#f0f6ff" fill-opacity="0.16"/>
    <rect x="${px(24)}" y="${py(296)}" width="${PHONE.w - 48}" height="88" rx="12" fill="#0ea5e9" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.08"/>
    <circle cx="${px(PHONE.w / 2)}" cy="${py(340)}" r="7" fill="#06b6d4"/>
    <circle cx="${px(PHONE.w - 40)}" cy="${py(PHONE.h - 52)}" r="17" fill="#10b981"/>
  </g>`;

// Cuadrícula MS: líneas cada 52 px que se desvanecen hacia abajo y a la derecha.
const grid = [];
for (let x = 0; x <= W; x += 52) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
for (let y = 0; y <= H; y += 52) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080f1e"/>
      <stop offset="1" stop-color="#0b1424"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.86" cy="0.3" r="0.55">
      <stop offset="0" stop-color="#0ea5e9" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#0ea5e9" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="fade" cx="0.3" cy="0.4" r="0.8">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="gridMask"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g stroke="#ffffff" stroke-opacity="0.05" mask="url(#gridMask)">${grid.join("")}</g>
  ${phone}
  <text x="72" y="244" font-family="${FONT}" font-size="76" font-weight="700" fill="#f0f6ff" letter-spacing="-2">Páginas web para</text>
  <text x="72" y="330" font-family="${FONT}" font-size="76" font-weight="700" fill="#f0f6ff" letter-spacing="-2">negocios en <tspan fill="#0ea5e9">Honduras.</tspan></text>
  <text x="72" y="396" font-family="${FONT}" font-size="26" fill="#94a3b8">Código propio en React, sin plantillas.</text>
  ${chips}
  <text x="72" y="578" font-family="${MONO}" font-size="19" fill="#64748b">www.multistacksystems.com</text>
</svg>`);

const isotipo = await sharp(resolve(BRAND, "isotipo-oscuro-2x.png")).resize({ height: MARK.height }).toBuffer();
const wordmark = await sharp(resolve(BRAND, "wordmark-oscuro-2x.png")).resize({ height: MARK.height }).toBuffer();
const isotipoWidth = (await sharp(isotipo).metadata()).width;

await mkdir(OUT, { recursive: true });

const base = sharp(svg).composite([
  { input: isotipo, left: MARK.left, top: MARK.top },
  { input: wordmark, left: MARK.left + isotipoWidth + GAP, top: MARK.top },
]);

const png = await base.clone().png({ compressionLevel: 9 }).toFile(resolve(OUT, "og-home.v3.1200x630.png"));
const webp = await base.clone().webp({ quality: 82 }).toFile(resolve(OUT, "og-home.v3.1200x630.webp"));
console.log(`og-home.v3.1200x630.png  ${png.width}x${png.height}  ${(png.size / 1024).toFixed(1)} KB`);
console.log(`og-home.v3.1200x630.webp ${webp.width}x${webp.height}  ${(webp.size / 1024).toFixed(1)} KB`);
