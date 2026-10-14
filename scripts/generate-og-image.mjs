/**
 * Generate the Open Graph / Twitter share image for the AI-services pivot.
 *
 * Output : public/assets/images/og/og-ai.1200x630.png   (og:image — PNG for
 *          crawlers that reject WebP)
 *          public/assets/images/og/og-ai.1200x630.webp  (lighter variant)
 *
 * Composition: hero first frame (cover-cropped) + white mark + headline.
 * Re-run after replacing the hero frames with the final art.
 *
 * Run: node scripts/generate-og-image.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = resolve(__dirname, "..", "public");
const OUT = resolve(pub, "assets", "images", "og");
const W = 1200;
const H = 630;

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#080f1e" stop-opacity="0.92"/>
      <stop offset="0.6" stop-color="#080f1e" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#080f1e" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <text x="72" y="214" font-family="${MONO}" font-size="20" letter-spacing="4" fill="#06b6d4">// SERVICIOS PRODUCTIZADOS DE IA</text>
  <text x="72" y="300" font-family="${FONT}" font-size="64" font-weight="700" fill="#f0f6ff">Tu operación,</text>
  <text x="72" y="378" font-family="${FONT}" font-size="64" font-weight="700" fill="#0ea5e9">en piloto automático.</text>
  <text x="72" y="446" font-family="${FONT}" font-size="26" fill="#94a3b8">Agentes de IA (RAG) · Automatización cero papel con n8n · Integración B2B</text>
  <rect x="72" y="520" width="56" height="2" fill="#06b6d4"/>
  <text x="72" y="560" font-family="${MONO}" font-size="20" fill="#94a3b8">multistacksystems.com</text>
</svg>`);

const logo = await sharp(resolve(pub, "logo-white.png")).trim().resize({ height: 54 }).toBuffer();

await mkdir(OUT, { recursive: true });

const base = sharp(resolve(pub, "assets", "scenes", "hero", "hero-01.1080.webp"))
  .resize(W, H, { fit: "cover", position: "right" })
  .composite([
    { input: overlay, top: 0, left: 0 },
    { input: logo, top: 72, left: 72 },
  ]);

const png = await base.clone().png({ compressionLevel: 9 }).toFile(resolve(OUT, "og-ai.1200x630.png"));
const webp = await base.clone().webp({ quality: 82 }).toFile(resolve(OUT, "og-ai.1200x630.webp"));
console.log(`og-ai.1200x630.png  ${(png.size / 1024).toFixed(1)} KB`);
console.log(`og-ai.1200x630.webp ${(webp.size / 1024).toFixed(1)} KB`);
