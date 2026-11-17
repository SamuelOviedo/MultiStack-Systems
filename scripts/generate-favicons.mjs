/**
 * Genera el juego de favicons e iconos de aplicación a partir del isotipo oficial.
 *
 * Fuente : src/assets/brand/isotipo-oscuro-4x.png  (isotipo oficial, versión «oscuro» = teal y blanco, 484x382, alfa)
 * Salida : public/  (favicon.ico, favicon-48x48.png, favicon-96x96.png, apple-touch-icon.png, icon-192.png,
 *          icon-512.png, icon-maskable-512.png)
 *
 * El isotipo va centrado, sin deformar, sobre un cuadrado liso de azul medianoche oficial (#080C13, el píxel del PNG
 * oficial). Márgenes:
 *   - estándar (96, 180, 192, 512): el isotipo ocupa el 66 % del lado (17 % de margen por lado);
 *   - maskable (512): 60 % (20 %), dentro de la zona segura del recorte circular;
 *   - pestaña del navegador (favicon-48x48.png y los 16/32/48 del .ico): 84 % (8 % por lado), más legible a 16 px.
 * Los tamaños de 48 px son múltiplos de 48, como pide Google para los favicons de los resultados de búsqueda
 * (https://developers.google.com/search/docs/appearance/favicon-in-search).
 *
 * Los archivos de public/ son los derivados maestros de la identidad, remuestreados una sola vez desde el original.
 * Este script parte del isotipo @4x ya reducido, así que su salida NO es idéntica bit a bit: la
 * diferencia media absoluta frente a los maestros es de 0,2 a 0,8 sobre 255 de 96 a 512 px, de 1,4 en
 * favicon-48x48.png y de 5,0 y 5,6 en los 32 y 16 px del .ico. Posición y tamaño coinciden; solo cambia el suavizado de los bordes. Si hace falta el archivo exacto, el de public/
 * manda. Con `--out <carpeta>` se escribe en otra carpeta y public/ no se toca.
 *
 * Ejecutar: node scripts/generate-favicons.mjs [--out <carpeta>]
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outArg = process.argv.indexOf("--out");
const out = outArg > -1 ? resolve(process.argv[outArg + 1]) : resolve(root, "public");

const SRC = resolve(root, "src", "assets", "brand", "isotipo-oscuro-4x.png");
const BG = { r: 0x08, g: 0x0c, b: 0x13, alpha: 1 }; // #080C13 azul medianoche oficial

/** `w` y `h`: caja (px) del isotipo dentro del lienzo, con la proporción real 484:382. Ajustadas a los maestros. */
const TAB = { 16: { w: 14, h: 10 }, 32: { w: 26, h: 22 }, 48: { w: 40, h: 32 } };
const PNG_TARGETS = [
  ["favicon-48x48.png", 48, TAB[48]],
  ["favicon-96x96.png", 96, { w: 64, h: 50 }],
  ["apple-touch-icon.png", 180, { w: 118, h: 94 }],
  ["icon-192.png", 192, { w: 126, h: 100 }],
  ["icon-512.png", 512, { w: 338, h: 268 }],
  ["icon-maskable-512.png", 512, { w: 308, h: 242 }],
];

/** Isotipo en la caja indicada, centrado sobre un cuadrado liso. */
async function makeIcon(size, { w, h }) {
  const mark = await sharp(SRC).resize(w, h, { fit: "fill", kernel: "lanczos3" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: mark, left: Math.floor((size - w) / 2), top: Math.floor((size - h) / 2) }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(out, { recursive: true });
  for (const [name, size, box] of PNG_TARGETS) {
    await writeFile(resolve(out, name), await makeIcon(size, box));
    console.log(`  ok ${name} (${size}x${size})`);
  }

  // .ico de varias resoluciones para clientes antiguos (16 / 32 / 48), con el margen de pestaña.
  const icoSources = await Promise.all(Object.entries(TAB).map(([size, box]) => makeIcon(Number(size), box)));
  await writeFile(resolve(out, "favicon.ico"), await pngToIco(icoSources));
  console.log("  ok favicon.ico (16/32/48)");

  console.log(`Listo. Iconos escritos en ${out}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
