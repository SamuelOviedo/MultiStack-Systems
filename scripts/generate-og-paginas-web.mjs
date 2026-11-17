/**
 * Genera la imagen social de /paginas-web con la identidad oficial (v2).
 *
 * Entrada: public/assets/images/og/og-paginas-web.png  (v1, se conserva en disco: es la base de la composición)
 *          src/assets/brand/isotipo-oscuro-2x.png      (isotipo oficial «oscuro»)
 *          src/assets/brand/wordmark-oscuro-2x.png     (rótulo oficial «MultiStack SYSTEMS», «oscuro»)
 * Salida : public/assets/images/og/og-paginas-web.v2.png  (1200x630)
 *
 * No hay fuente editable de la composición (solo el PNG), así que solo se sustituye el bloque de marca de la
 * esquina superior izquierda y todo lo demás (fondo, titular, subtítulo, chips y tipografía) queda idéntico píxel a
 * píxel. El fondo es un degradado casi plano con una cuadrícula tenue de 52 px de período (en x e y): el parche que
 * tapa la marca anterior es la misma franja del propio PNG desplazada exactamente un período hacia arriba (52 px),
 * que no contiene nada más que fondo, así que la cuadrícula y el degradado continúan sin costura.
 * Encima va el conjunto oficial isotipo + rótulo, con la misma altura (40 px) y esquina (72, 120) que la marca anterior.
 * Proporciones reales de los archivos, sin deformar.
 *
 * Ejecutar: node scripts/generate-og-paginas-web.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OG = resolve(root, "public", "assets", "images", "og");
const BRAND = resolve(root, "src", "assets", "brand");

const PERIOD = 52; // período de la cuadrícula de fondo, px
const PATCH = { left: 66, top: 114, width: 300, height: 52 }; // cubre la marca anterior (x 72-363, y 120-159) con margen
const MARK = { left: 72, top: 120, height: 40 }; // misma esquina y altura que la marca anterior
const GAP = 11; // separación isotipo-rótulo del conjunto: 0,28 de la altura, como en el Logo del sitio

const base = resolve(OG, "og-paginas-web.png");

const background = await sharp(base)
  .extract({ left: PATCH.left, top: PATCH.top - PERIOD, width: PATCH.width, height: PATCH.height })
  .toBuffer();
const isotipo = await sharp(resolve(BRAND, "isotipo-oscuro-2x.png")).resize({ height: MARK.height }).toBuffer();
const wordmark = await sharp(resolve(BRAND, "wordmark-oscuro-2x.png")).resize({ height: MARK.height }).toBuffer();
const isotipoWidth = (await sharp(isotipo).metadata()).width;

const info = await sharp(base)
  .composite([
    { input: background, left: PATCH.left, top: PATCH.top },
    { input: isotipo, left: MARK.left, top: MARK.top },
    { input: wordmark, left: MARK.left + isotipoWidth + GAP, top: MARK.top },
  ])
  .png({ compressionLevel: 9 })
  .toFile(resolve(OG, "og-paginas-web.v2.png"));

console.log(`og-paginas-web.v2.png  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`);
