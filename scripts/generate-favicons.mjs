/**
 * Generate the full favicon / web-app icon set from the official logo.
 *
 * Source : public/logo-white.png  (white mark, portrait 727x845, transparent)
 * Output : public/  (favicon.ico, PNG favicons, apple-touch-icon, PWA icons)
 *
 * The white mark is centered on the brand navy (#080F1E, matches the
 * <meta name="theme-color">) square so it stays visible on both light and
 * dark browser chrome. Sizes are multiples of 48px per Google's favicon
 * guidelines (https://developers.google.com/search/docs/appearance/favicon-in-search).
 *
 * Run: node scripts/generate-favicons.mjs
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = resolve(__dirname, "..", "public");

const SRC = resolve(pub, "logo-white.png");
const BG = { r: 0x08, g: 0x0f, b: 0x1e, alpha: 1 }; // #080F1E brand navy
const PADDING = 0.16; // fraction of the canvas reserved as empty margin

/** Render the trimmed logo, contained + centered, on a solid square canvas. */
async function makeIcon(size) {
  const inner = Math.round(size * (1 - 2 * PADDING));
  const logo = await sharp(SRC)
    .trim() // drop transparent border so the mark fills the inner box
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

const PNG_TARGETS = [
  ["favicon-48x48.png", 48],
  ["favicon-96x96.png", 96],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];

async function main() {
  for (const [name, size] of PNG_TARGETS) {
    const buf = await makeIcon(size);
    await writeFile(resolve(pub, name), buf);
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Multi-resolution .ico for legacy clients (16 / 32 / 48).
  const icoSources = await Promise.all([16, 32, 48].map((s) => makeIcon(s)));
  const ico = await pngToIco(icoSources);
  await writeFile(resolve(pub, "favicon.ico"), ico);
  console.log("  ✓ favicon.ico (16/32/48)");

  console.log("Done. Icon set written to public/.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
